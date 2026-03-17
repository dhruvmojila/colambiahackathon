"""
SignPulse AI — FastAPI Backend
Continuous ASL Recognition using I3D pretrained on WLASL-300
"""

import os
import base64
import tempfile
import logging
from contextlib import asynccontextmanager
from typing import Optional

import cv2
import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ──────────────────────────────────────────────
# LOGGING
# ──────────────────────────────────────────────
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("signpulse")

# ──────────────────────────────────────────────
# WLASL TOP-300 GLOSS LIST  (index → word)
# Add / swap entries to match your checkpoint's classes.
# ──────────────────────────────────────────────
WLASL_CLASSES = [
    "book","drink","computer","before","chair","go","clothes","who","candy","cousin",
    "deaf","fine","help","house","like","many","mother","now","orange","people",
    "pizza","play","school","shoe","student","teacher","think","walk","what","white",
    "write","yes","all","black","blue","but","buy","by","can","change",
    "color","come","cool","dark","day","different","down","eat","enjoy","family",
    "fast","feel","find","first","forget","friend","funny","girl","give","good",
    "green","grow","happy","have","he","hear","here","herself","hot","how",
    "if","important","into","it","know","last","later","learn","leave","letter",
    "little","live","long","love","make","man","may","money","more","morning",
    "name","need","never","next","nice","night","no","not","nothing","of",
    "often","old","on","or","other","our","out","own","pay","phone",
    "please","prefer","problem","put","read","ready","red","remember","ride","right",
    "same","say","see","share","she","should","show","sick","sign","slow",
    "small","so","some","soon","sorry","stop","story","strong","sure","take",
    "tell","than","that","the","their","them","then","there","they","time",
    "to","today","together","tomorrow","too","try","turn","understand","up","us",
    "use","very","wait","want","week","well","when","where","which","why",
    "will","with","woman","work","world","would","year","you","your","yourself",
    "hospital","pain","help","emergency","medicine","nurse","doctor","water","food","bathroom",
    "sleep","hurt","please","thank","yes","no","sorry","again","repeat","slow",
    # — extend to 300 to match your checkpoint ——
]
# Pad to 300 if needed
while len(WLASL_CLASSES) < 300:
    WLASL_CLASSES.append(f"class_{len(WLASL_CLASSES)}")

NUM_CLASSES = len(WLASL_CLASSES)   # 300


# ──────────────────────────────────────────────
# MINIMAL I3D ARCHITECTURE  (drop-in compatible with WLASL .pth checkpoints)
# Reference: Carreira & Zisserman 2017
# ──────────────────────────────────────────────

class MaxPool3dSamePadding(nn.MaxPool3d):
    """MaxPool3d with 'SAME' padding to match TF/original I3D."""
    def compute_pad(self, dim, s):
        if s % self.stride[dim] == 0:
            return max(self.kernel_size[dim] - self.stride[dim], 0)
        return max(self.kernel_size[dim] - (s % self.stride[dim]), 0)

    def forward(self, x):
        (batch, channel, t, h, w) = x.size()
        pad_t = self.compute_pad(0, t)
        pad_h = self.compute_pad(1, h)
        pad_w = self.compute_pad(2, w)
        x = F.pad(x, [pad_w // 2, pad_w - pad_w // 2,
                       pad_h // 2, pad_h - pad_h // 2,
                       pad_t // 2, pad_t - pad_t // 2])
        return super().forward(x)


class Unit3D(nn.Module):
    def __init__(self, in_channels, out_channels, kernel_size=(1,1,1),
                 stride=(1,1,1), padding=0, activation_fn=F.relu,
                 use_batch_norm=True, use_bias=False, name="unit_3d"):
        super().__init__()
        self._out_channels   = out_channels
        self._activation_fn  = activation_fn
        self._use_batch_norm = use_batch_norm
        self.name = name

        self.conv3d = nn.Conv3d(in_channels, out_channels, kernel_size,
                                stride=stride, padding=padding, bias=use_bias)
        if use_batch_norm:
            self.bn = nn.BatchNorm3d(out_channels, eps=0.001, momentum=0.01)

    def compute_pad(self, dim, s, k, st):
        if s % st == 0:
            return max(k - st, 0)
        return max(k - (s % st), 0)

    def forward(self, x):
        x = self.conv3d(x)
        if self._use_batch_norm:
            x = self.bn(x)
        if self._activation_fn is not None:
            x = self._activation_fn(x, inplace=True) if self._activation_fn is F.relu else self._activation_fn(x)
        return x


class InceptionModule(nn.Module):
    def __init__(self, in_channels, out_channels, name):
        super().__init__()
        self.b0 = Unit3D(in_channels, out_channels[0], kernel_size=(1,1,1), name=name+"/Branch_0/Conv3d_0a_1x1")
        self.b1a = Unit3D(in_channels, out_channels[1], kernel_size=(1,1,1), name=name+"/Branch_1/Conv3d_0a_1x1")
        self.b1b = Unit3D(out_channels[1], out_channels[2], kernel_size=(3,3,3), padding=1, name=name+"/Branch_1/Conv3d_0b_3x3")
        self.b2a = Unit3D(in_channels, out_channels[3], kernel_size=(1,1,1), name=name+"/Branch_2/Conv3d_0a_1x1")
        self.b2b = Unit3D(out_channels[3], out_channels[4], kernel_size=(3,3,3), padding=1, name=name+"/Branch_2/Conv3d_0b_3x3")
        self.b3a = MaxPool3dSamePadding(kernel_size=(3,3,3), stride=(1,1,1), padding=0)
        self.b3b = Unit3D(in_channels, out_channels[5], kernel_size=(1,1,1), name=name+"/Branch_3/Conv3d_0b_1x1")
        self.name = name

    def forward(self, x):
        b0 = self.b0(x)
        b1 = self.b1b(self.b1a(x))
        b2 = self.b2b(self.b2a(x))
        b3 = self.b3b(self.b3a(x))
        return torch.cat([b0, b1, b2, b3], dim=1)


class InceptionI3d(nn.Module):
    """
    Inflated 3D ConvNet (I3D) — RGB stream.
    Compatible with official WLASL checkpoint keys.
    """
    VALID_ENDPOINTS = (
        "Conv3d_1a_7x7","MaxPool3d_2a_3x3","Conv3d_2b_1x1","Conv3d_2c_3x3",
        "MaxPool3d_3a_3x3","Mixed_3b","Mixed_3c","MaxPool3d_4a_3x3",
        "Mixed_4b","Mixed_4c","Mixed_4d","Mixed_4e","Mixed_4f",
        "MaxPool3d_5a_2x2","Mixed_5b","Mixed_5c","Logits","Predictions",
    )

    def __init__(self, num_classes=400, spatial_squeeze=True,
                 final_endpoint="Logits", in_channels=3, dropout_keep_prob=0.5):
        super().__init__()
        self._num_classes        = num_classes
        self._spatial_squeeze    = spatial_squeeze
        self._final_endpoint     = final_endpoint
        self.dropout_keep_prob   = dropout_keep_prob

        self.end_points = {}
        end_point = "Conv3d_1a_7x7"
        self.add_module(end_point, Unit3D(in_channels, 64, kernel_size=(7,7,7), stride=(2,2,2), padding=(3,3,3), name=end_point))
        if self._final_endpoint == end_point: return

        end_point = "MaxPool3d_2a_3x3"
        self.add_module(end_point, MaxPool3dSamePadding(kernel_size=(1,3,3), stride=(1,2,2), padding=0))
        if self._final_endpoint == end_point: return

        end_point = "Conv3d_2b_1x1"
        self.add_module(end_point, Unit3D(64, 64, kernel_size=(1,1,1), name=end_point))
        if self._final_endpoint == end_point: return

        end_point = "Conv3d_2c_3x3"
        self.add_module(end_point, Unit3D(64, 192, kernel_size=(3,3,3), padding=1, name=end_point))
        if self._final_endpoint == end_point: return

        end_point = "MaxPool3d_3a_3x3"
        self.add_module(end_point, MaxPool3dSamePadding(kernel_size=(1,3,3), stride=(1,2,2), padding=0))
        if self._final_endpoint == end_point: return

        end_point = "Mixed_3b"
        self.add_module(end_point, InceptionModule(192, [64,96,128,16,32,32], end_point))
        if self._final_endpoint == end_point: return

        end_point = "Mixed_3c"
        self.add_module(end_point, InceptionModule(256, [128,128,192,32,96,64], end_point))
        if self._final_endpoint == end_point: return

        end_point = "MaxPool3d_4a_3x3"
        self.add_module(end_point, MaxPool3dSamePadding(kernel_size=(3,3,3), stride=(2,2,2), padding=0))
        if self._final_endpoint == end_point: return

        end_point = "Mixed_4b"
        self.add_module(end_point, InceptionModule(128+192+96+64, [192,96,208,16,48,64], end_point))
        if self._final_endpoint == end_point: return

        end_point = "Mixed_4c"
        self.add_module(end_point, InceptionModule(192+208+48+64, [160,112,224,24,64,64], end_point))
        if self._final_endpoint == end_point: return

        end_point = "Mixed_4d"
        self.add_module(end_point, InceptionModule(160+224+64+64, [128,128,256,24,64,64], end_point))
        if self._final_endpoint == end_point: return

        end_point = "Mixed_4e"
        self.add_module(end_point, InceptionModule(128+256+64+64, [112,144,288,32,64,64], end_point))
        if self._final_endpoint == end_point: return

        end_point = "Mixed_4f"
        self.add_module(end_point, InceptionModule(112+288+64+64, [256,160,320,32,128,128], end_point))
        if self._final_endpoint == end_point: return

        end_point = "MaxPool3d_5a_2x2"
        self.add_module(end_point, MaxPool3dSamePadding(kernel_size=(2,2,2), stride=(2,2,2), padding=0))
        if self._final_endpoint == end_point: return

        end_point = "Mixed_5b"
        self.add_module(end_point, InceptionModule(256+320+128+128, [256,160,320,32,128,128], end_point))
        if self._final_endpoint == end_point: return

        end_point = "Mixed_5c"
        self.add_module(end_point, InceptionModule(256+320+128+128, [384,192,384,48,128,128], end_point))
        if self._final_endpoint == end_point: return

        end_point = "Logits"
        self.avg_pool = nn.AvgPool3d(kernel_size=(2,7,7), stride=(1,1,1))
        self.dropout  = nn.Dropout(p=1 - self.dropout_keep_prob)
        self.logits   = Unit3D(384+384+128+128, num_classes, kernel_size=(1,1,1),
                               activation_fn=None, use_batch_norm=False,
                               use_bias=True, name="logits")

    def forward(self, x):
        # x: [B, C, T, H, W]
        for end_point in self.VALID_ENDPOINTS:
            if hasattr(self, end_point):
                x = self._modules[end_point](x)

        x = self.logits(self.dropout(self.avg_pool(x)))
        if self._spatial_squeeze:
            x = x.squeeze(3).squeeze(3)
        # x shape: [B, num_classes, T]
        x = x.mean(2)   # temporal average → [B, num_classes]
        return x


# ──────────────────────────────────────────────
# GLOBAL MODEL STATE
# ──────────────────────────────────────────────
model: Optional[InceptionI3d] = None
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
DEMO_MODE = False   # flipped to True when no checkpoint found


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load model at startup, release at shutdown."""
    global model, DEMO_MODE
    checkpoint_path = os.environ.get("MODEL_PATH", "wlasl_model.pth")

    if os.path.exists(checkpoint_path):
        logger.info(f"Loading checkpoint from {checkpoint_path} …")
        try:
            state = torch.load(checkpoint_path, map_location=device)
            # Some checkpoints wrap weights under a key
            if isinstance(state, dict) and "model_state_dict" in state:
                state = state["model_state_dict"]
            elif isinstance(state, dict) and "state_dict" in state:
                state = state["state_dict"]

            model = InceptionI3d(num_classes=NUM_CLASSES, in_channels=3)
            model.load_state_dict(state, strict=False)
            model = model.to(device)
            model.eval()
            logger.info("✅  Model loaded successfully.")
        except Exception as e:
            logger.error(f"Checkpoint load failed: {e}. Falling back to demo mode.")
            DEMO_MODE = True
    else:
        logger.warning(f"No checkpoint at '{checkpoint_path}'. Running in DEMO mode.")
        DEMO_MODE = True

    yield  # app runs here

    logger.info("Shutting down SignPulse API.")


app = FastAPI(title="SignPulse AI Backend", version="2.0.0", lifespan=lifespan)

# ──────────────────────────────────────────────
# CORS  — allow Next.js dev + Vercel production
# ──────────────────────────────────────────────
ALLOWED_ORIGINS = os.environ.get(
    "ALLOWED_ORIGINS",
    "http://localhost:3000,http://localhost:3001,https://signpulse-backend-973006952011.us-central1.run.app,https://signpulse-ai-om4pzzzkja-uc.a.run.app,https://signpulseai.me,https://www.signpulseai.me"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ──────────────────────────────────────────────
# SCHEMAS
# ──────────────────────────────────────────────
class VideoPayload(BaseModel):
    """
    Send a base64-encoded video clip from the browser.
    Optionally include a data-URI prefix — it will be stripped automatically.
    e.g.  { "video_base64": "data:video/webm;base64,AAAA..." }
    """
    video_base64: str
    num_classes: Optional[int] = None   # override if your checkpoint has ≠300 classes


class PredictionResponse(BaseModel):
    status: str
    intent: str
    confidence: float
    top5: list[dict]
    demo_mode: bool


# ──────────────────────────────────────────────
# VIDEO PROCESSING HELPERS
# ──────────────────────────────────────────────
TARGET_FRAMES = 16      # I3D expects ≥8; 16 is a sweet spot for 2-second clips
FRAME_SIZE    = 224     # spatial input size


def decode_base64_to_tensor(b64: str) -> torch.Tensor:
    """
    Convert a base64 video string → PyTorch tensor [1, 3, T, H, W] float32 in [0,1].
    """
    # Strip data-URI header if present
    if "," in b64:
        b64 = b64.split(",", 1)[1]

    video_bytes = base64.b64decode(b64)

    # Write to temp file (cv2 needs a file path, not bytes)
    with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tmp:
        tmp.write(video_bytes)
        tmp_path = tmp.name

    try:
        cap = cv2.VideoCapture(tmp_path)
        if not cap.isOpened():
            raise ValueError("cv2 could not open the video. Is it a valid mp4/webm?")

        raw_frames = []
        while True:
            ok, frame = cap.read()
            if not ok:
                break
            # BGR → RGB, resize to 224×224
            frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            frame = cv2.resize(frame, (FRAME_SIZE, FRAME_SIZE))
            raw_frames.append(frame)
        cap.release()
    finally:
        os.unlink(tmp_path)

    if len(raw_frames) == 0:
        raise ValueError("Zero frames decoded from video.")

    # ── Temporal normalisation: sample exactly TARGET_FRAMES ──
    total = len(raw_frames)
    if total >= TARGET_FRAMES:
        # Uniform stride sampling
        indices = np.linspace(0, total - 1, TARGET_FRAMES, dtype=int)
    else:
        # Repeat last frame to pad
        indices = list(range(total)) + [total - 1] * (TARGET_FRAMES - total)

    frames = np.stack([raw_frames[i] for i in indices], axis=0)  # [T, H, W, C]
    # Normalize to [0, 1]
    frames = frames.astype(np.float32) / 255.0
    # [T, H, W, C] → [C, T, H, W] → [1, C, T, H, W]
    tensor = torch.from_numpy(frames).permute(3, 0, 1, 2).unsqueeze(0)
    return tensor.to(device)


def demo_prediction() -> dict:
    """Returns a realistic-looking fake result when no model is loaded."""
    import random
    medical_words = ["hospital", "help", "pain", "medicine", "doctor", "water", "bathroom", "please"]
    word = random.choice(medical_words)
    conf = round(random.uniform(0.78, 0.97), 4)
    top5 = [
        {"word": word, "confidence": conf},
        {"word": random.choice(medical_words), "confidence": round(conf - random.uniform(0.05, 0.15), 4)},
        {"word": random.choice(medical_words), "confidence": round(conf - random.uniform(0.20, 0.30), 4)},
        {"word": random.choice(medical_words), "confidence": round(conf - random.uniform(0.35, 0.45), 4)},
        {"word": random.choice(medical_words), "confidence": round(conf - random.uniform(0.50, 0.60), 4)},
    ]
    return {"intent": word, "confidence": conf, "top5": top5}


# ──────────────────────────────────────────────
# ROUTES
# ──────────────────────────────────────────────

@app.get("/", tags=["health"])
def health_check():
    return {
        "status": "SignPulse API is running",
        "demo_mode": DEMO_MODE,
        "device": str(device),
        "num_classes": NUM_CLASSES,
    }


@app.post("/predict", response_model=PredictionResponse, tags=["inference"])
async def predict_sign(payload: VideoPayload):
    """
    Accepts a base64-encoded video clip (2-second recommended).
    Returns the top predicted ASL word + confidence + top-5 alternatives.
    """
    if DEMO_MODE:
        demo = demo_prediction()
        return PredictionResponse(
            status="success (demo)",
            demo_mode=True,
            **demo
        )

    try:
        tensor = decode_base64_to_tensor(payload.video_base64)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=f"Video decode error: {e}")

    try:
        with torch.no_grad():
            logits = model(tensor)                  # [1, num_classes]
            probs  = F.softmax(logits, dim=1)[0]    # [num_classes]

        top5_idx = torch.topk(probs, k=min(5, NUM_CLASSES)).indices.tolist()
        top5 = [
            {"word": WLASL_CLASSES[i], "confidence": round(probs[i].item(), 4)}
            for i in top5_idx
        ]

        best_idx   = top5_idx[0]
        intent     = WLASL_CLASSES[best_idx]
        confidence = round(probs[best_idx].item(), 4)

        return PredictionResponse(
            status="success",
            intent=intent,
            confidence=confidence,
            top5=top5,
            demo_mode=False,
        )

    except Exception as e:
        logger.exception("Inference error")
        raise HTTPException(status_code=500, detail=f"Inference failed: {e}")
