# 🤟 SignPulse AI

![SignPulse Banner](https://img.shields.io/badge/Status-Live_Demo-emerald?style=for-the-badge) ![GCP](https://img.shields.io/badge/Google_Cloud-4285F4?style=for-the-badge&logo=google-cloud&logoColor=white) ![Next.js](https://img.shields.io/badge/Next.js_16-000000?style=for-the-badge&logo=nextdotjs&logoColor=white) ![Gemini](https://img.shields.io/badge/Gemini_3_Flash-1F2937?style=for-the-badge&logo=google&logoColor=white) ![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=FastAPI&logoColor=white)

**Live Demo:** [https://signpulse-ai-om4pzzzkja-uc.a.run.app](https://signpulse-ai-om4pzzzkja-uc.a.run.app)  
_Note: Please grant camera and microphone permissions when testing the application._

---

## 🎯 The Problem

Current sign language translation tools act like simple dictionaries, translating signs word-for-word. They miss crucial elements of human communication: **emotion, tone, and environmental context**. Without these, translations feel robotic and lose the nuance that native signers convey through facial expressions and body language.

## ✨ The Solution: SignPulse AI

SignPulse AI is a real-time, vision-enabled Live Agent that bridges the communication gap. It doesn't just translate hands—it translates the _person_.

By utilizing a **Dual-Pipeline Architecture**, SignPulse simultaneously tracks precise ASL signs via a custom PyTorch model and detects facial emotions via client-side WASM. This context is fed into **Google's Gemini 3 Flash** via the **Google ADK**, producing context-aware translations spoken aloud with emotive, dynamic text-to-speech.

### Key Features

- **👐 Real-Time ASL Detection:** Uses an I3D model trained on the WLASL-300 dataset for robust sign recognition.
- **😊 Emotion & Tone Mapping:** MediaPipe detects facial blendshapes client-side to infer emotion (happy, angry, confused, etc.), which is used to modulate the synthesized voice pitch and speed.
- **👁️ Environmental Context:** Gemini analyzes the background environment to contextualize the conversation.
- **🌍 Multilingual:** Instantly translates signs into 20+ spoken languages.
- **🚀 Mind-Blowing UI:** Immersive frontend featuring Three.js particle backgrounds, glassmorphism, floating emoji graffiti, and a responsive design.

---

## 🏗️ Architecture & Engine Flow

The application runs a unique dual-pipeline constraint:

1. **Client-Side WASM (MediaPipe):** Runs at ~15fps capturing hand bounding boxes and mapping facial blendshapes to emotions.
2. **Backend Microservice (FastAPI + I3D):** Captures 2-second overlapping video clips, sending them to a dedicated Cloud Run service for ASL intent prediction.
3. **Orchestration (Google ADK + Gemini):** Binds the visual frame, the detected ASL intent, and the detected face emotion to provide a highly accurate, human-like interpretation.

```mermaid
graph TD
    %% Styling
    classDef frontend fill:#0a0a18,stroke:#a78bfa,stroke-width:2px,color:#fff;
    classDef clientAi fill:#1e1e2f,stroke:#22d3ee,stroke-width:2px,color:#fff;
    classDef backend fill:#1e1e2f,stroke:#f43f5e,stroke-width:2px,color:#fff;
    classDef gcp fill:#1e1e2f,stroke:#4ade80,stroke-width:2px,color:#fff;
    classDef user fill:#2d1b69,stroke:#a78bfa,stroke-width:2px,color:#fff,stroke-dasharray: 5 5;

    %% Nodes
    User(("👤 User\n(Signing & Expressions)")):::user

    subgraph "Frontend Engine (Next.js 16)"
        UI["🖥️ UI Layer\n(React, Tailwind, Three.js)"]:::frontend
        Camera["📷 Camera Feed\n(WebRTC)"]:::frontend
    end

    subgraph "Client-Side Processing"
        MediaPipe["🧠 MediaPipe (WASM)\n- Hand Bounding Boxes\n- Face Blendshapes (Emotion)"]:::clientAi
    end

    subgraph "Sign Detection Microservice"
        I3D["👐 I3D Model (FastAPI)\n(Pretrained on WLASL-300)"]:::backend
    end

    subgraph "Google Cloud Platform (GCP)"
        ADK["🤖 Google ADK\n(Live Agent Orchestration)"]:::gcp
        Gemini["✨ Gemini 3 Flash\n(Multimodal Vision + Context)"]:::gcp
        TTS["🗣️ Cloud Text-to-Speech\n(Emotive & Multilingual)"]:::gcp
    end

    %% Flow
    User -->|Video| Camera
    Camera --> UI

    %% Dual Pipeline Split
    Camera -->|Frames (~15fps)| MediaPipe
    Camera -->|2s Video Clips| I3D
    Camera -->|Keyframes| ADK

    %% Client AI
    MediaPipe -->|Face Emotion| ADK
    MediaPipe -->|Visual Overlay| UI

    %% Sign API
    I3D -->|Detected ASL Intent| ADK

    %% GCP Orchestration
    ADK -->|Context (Frames + Sign + Emotion)| Gemini
    Gemini -->|Translated Text + Detected Emotion| ADK
    ADK -->|Text + Prosody config| TTS

    %% Output
    ADK -->|Live Transcript| UI
    TTS -->|Synthesized Audio| UI
    UI -->|Audio + Visual Feedback| User
```

---

## 🛠️ Technology Stack

**Frontend**

- Next.js 16 (App Router + Turbopack)
- React 19
- Tailwind CSS v4
- Three.js (`@react-three/fiber`, `@react-three/drei`)
- MediaPipe (`@mediapipe/tasks-vision` via WASM)

**Backend / Cloud**

- **Google ADK** (`@google/adk`)
- Google Vertex AI (Gemini 3 Flash API)
- Google Cloud Text-to-Speech
- Google Cloud Run (Containerized deployment)

**Sign Detection Microservice**

- FastAPI
- PyTorch (Inflated 3D ConvNet - I3D)
- OpenCV

---

## 🚀 Running Locally

### 1. Main Next.js App

Clone the repository and install dependencies:

```bash
npm install
```

Set up your `.env` file:

```env
# Path to your GCP service account JSON key with Vertex AI and TTS permissions
GOOGLE_APPLICATION_CREDENTIALS="service-account.json"

# Deployed Sign API URL
NEXT_PUBLIC_SIGNPULSE_API="https://signpulse-backend-973006952011.us-central1.run.app"
```

Start the development server:

```bash
npm run dev
```

### 2. Sign Detection Microservice (Optional)

If you want to run the python modeling backend locally instead of using the deployed Cloud Run instance:

```bash
cd sign-api
python -m venv venv
source venv/bin/activate  # On Windows: .\venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

_(You will need to place your WLASL `wlasl_model.pth` checkpoint inside the `sign-api` directory)._

---

## 👥 Team Members and Contributors

- Monika Dineshbhbai Patel
- Rudriben PatanjaliKumar Trivedi
- Vraj Manishkumar Patel
- Dhruv Rakeshkumar Mojila
