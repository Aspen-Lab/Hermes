# Hermes

Agent-powered personalized recommendations for PhD students: papers, academic events, and job opportunities. Delivered in a clean iOS app with a Discovery feed and Profile-based personalization.

## Features

- **Discovery feed** — Recommended Papers, Events, and Jobs in one place, with pull-to-refresh.
- **Detail views** — Papers (title, authors, AI summary, links to paper/arXiv/Scholar/code), Events (type, date, location, deadline, links), Jobs (role, company, requirements, match reason, apply link).
- **Feedback loop** — Save, Not Interested, and “More Like This” to improve future recommendations.
- **Profile & interests** — Research topics, preferred venues, career stage, industry vs academia, location and method preferences (persisted locally; ready to feed into an agent backend).

## Requirements

- Xcode 15+ (Swift 5.9+)
- iOS 17+

## Setup and run

1. **Open in Xcode**
   - Open `Hermes.xcodeproj` in Xcode, or create a new iOS App (SwiftUI, Swift, minimum deployment iOS 17) and add the `Hermes` folder as the app’s source (ensure “Copy items if needed” and your app target are selected).

2. **If you created a new project**
   - Set the app’s entry point to the existing `HermesApp.swift` (delete the default `ContentView` entry if you prefer), or add the `Hermes` group to the project and set the target’s main interface to the SwiftUI App lifecycle with `HermesApp` as the app struct.

3. **Run**
   - Select a simulator or device and press **Run** (⌘R).

## Project structure

```
Hermes/
├── App/
│   └── HermesApp.swift           # App entry, env objects
├── Models/
│   ├── Paper.swift
│   ├── Event.swift
│   ├── Job.swift
│   └── UserProfile.swift
├── State/
│   ├── FeedState.swift           # Feed data + feedback actions
│   └── ProfileState.swift        # User profile persistence
├── Services/
│   └── RecommendationService.swift  # Mock API + feedback; replace with real agent/API
├── Theme/
│   └── Theme.swift               # Colors, card style, buttons
├── Views/
│   ├── MainTabView.swift         # Discovery | Profile tabs
│   ├── Discovery/
│   │   ├── DiscoveryView.swift   # Home feed + nav to details
│   │   ├── FeedCardView.swift    # Card + action bar
│   │   ├── PapersSectionView.swift
│   │   ├── EventsSectionView.swift
│   │   └── JobsSectionView.swift
│   ├── Detail/
│   │   ├── PaperDetailView.swift
│   │   ├── EventDetailView.swift
│   │   └── JobDetailView.swift
│   └── Profile/
│       └── ProfileView.swift     # Interests & career prefs
└── Assets.xcassets               # App icon & accent (optional)
```

## Backend / agent integration

The app is ready for an agent-backed API:

1. **RecommendationService** — Replace `fetchRecommendations` with a call to your backend. The backend should use the **context layer** (user profile, saved/read papers, preferences, feedback) to return personalized papers, events, and jobs.
2. **Feedback** — `submitFeedback(itemId:type:feedback:)` is called for Save, Not Interested, and More Like This; send these to your API so the agent can update the user’s interest model.
3. **Profile** — Sync `UserProfile` (research topics, venues, career stage, industry preference, locations, methods) to your backend so recommendations can be personalized from day one.
4. **Delivery** — For “twice daily (morning + night)” delivery, implement push notifications or a background refresh that triggers `loadFeed()` and/or have the backend send push payloads with new recommendation summaries.

## Data sources (backend)

- **Papers:** arXiv, Semantic Scholar, CrossRef, conference proceedings (NeurIPS, ICLR, CHI, etc.).
- **Events:** Conference sites, academic calendars, community listings.
- **Jobs:** Company career pages, academic job boards, lab and startup listings.

---

Built for PhD students and researchers in STEM (AI, ML, HCI, CS and related fields).
