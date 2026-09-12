# KUKKO AI 🎯

## Basic Details

**Team Name:** AFK

**Team Members**

**Team Lead:** Abhinav V
Cochin University College of Engineering Kuttanad

**Member 2:** Aswin P Pai

## Project Description

Kukko is an AI browser companion that understands your voice, language and browsing activity. This mischievous parrot reacts to what you do with humour, sarcasm and personality. It can talk with you, understand Malayalam, English and Manglish, and react to your browsing habits.

## What ridiculous problem are you solving?

People open their browser to study or finish work and somehow end up spending hours watching random videos, scrolling social media or doing absolutely nothing productive. Kukko solves this very serious problem by becoming the unhelpful parrot that watches what you do and comments on it.

## The Solution

Kukko is an AI parrot that lives inside your browser. It talks to you, understands what you are doing and reacts accordingly. If you start studying, Kukko may sarcastically discourage you. If you start wasting time, Kukko happily supports your terrible decision. It can also remember things you said earlier and bring them up later.

# Technical Details

## Technologies and Components Used

### For Software

**Languages:** Python, HTML, CSS, JavaScript

**Frameworks:** FastAPI

**Libraries:** FastAPI, Uvicorn and required AI service SDKs

**Tools:** Git, GitHub, VS Code and Chrome Extension APIs

### For Hardware

No special hardware is required.

A laptop or desktop computer with a microphone and internet connection is sufficient.

# Implementation

## For Software

The project consists of a FastAPI backend and a browser extension frontend. The backend handles AI processing, speech recognition, text generation, personality, safety and voice generation. The frontend displays Kukko, handles user interaction, voice recording, audio playback and browser activity.

The basic flow is:

User → Browser Extension → Backend → AI Processing → Response → Kukko

## Installation

```bash
git clone <repository-url>
cd Kukko-Ai
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

## Run

```bash
uvicorn app.main:app --reload
```

Then load the browser extension in Chrome using Developer Mode and test Kukko with the running backend.

# Project Documentation

Kukko is designed as a playful AI browser companion rather than a normal chatbot. It combines conversational AI, voice interaction, browser awareness and an animated parrot character to create a fun and interactive browsing experience.
