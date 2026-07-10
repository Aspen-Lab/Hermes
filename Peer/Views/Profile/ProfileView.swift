//
//  ProfileView.swift
//  Peer
//

import SwiftUI

struct ProfileView: View {
    @EnvironmentObject var profileState: ProfileState
    @State private var researchTopicsText: String = ""
    @State private var locationsText: String = ""
    @State private var methodsText: String = ""
    @State private var userNameText: String = ""
    @State private var selectedVenue: String = "No preference"
    @State private var showLogoutConfirmation = false

    private let venueOptions = [
        "No preference",
        "NeurIPS",
        "ICLR",
        "ICML",
        "CVPR",
        "ACL",
        "EMNLP",
        "NAACL",
        "CHI",
        "KDD",
        "AAAI",
        "arXiv"
    ]

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 22) {
                    profileHeroCard
                    accountCard
                    agentContextCard

                    profileCard(
                        title: "Research topics",
                        subtitle: "Comma-separated interests (e.g. NLP, reinforcement learning, HCI).",
                        icon: "tag"
                    ) {
                        inputShell {
                            TextField("Add topics", text: $researchTopicsText, axis: .vertical)
                                .textFieldStyle(.plain)
                                .font(PeerTheme.bodyFont(PeerTheme.callout))
                                .foregroundColor(PeerTheme.textPrimary)
                                .lineLimit(3...6)
                                .onChange(of: researchTopicsText) { _, newValue in
                                    let list = newValue
                                        .split(separator: ",")
                                        .map { String($0.trimmingCharacters(in: .whitespaces)) }
                                        .filter { !$0.isEmpty }
                                    profileState.updateTopics(list)
                                }
                        }
                    }

                    profileCard(
                        title: "Preferred venue",
                        subtitle: "Choose your primary conference or source.",
                        icon: "graduationcap"
                    ) {
                        inputShell {
                            Menu {
                                ForEach(venueOptions, id: \.self) { option in
                                    Button(option) {
                                        selectedVenue = option
                                        if option == "No preference" {
                                            profileState.updateVenues([])
                                        } else {
                                            profileState.updateVenues([option])
                                        }
                                    }
                                }
                            } label: {
                                menuLabelText(selectedVenue)
                            }
                        }
                    }

                    profileCard(
                        title: "Career stage",
                        subtitle: "Current point in your research path.",
                        icon: "person.text.rectangle"
                    ) {
                        inputShell {
                            Menu {
                                ForEach(UserProfile.CareerStage.allCases, id: \.self) { stage in
                                    Button(stage.rawValue) {
                                        profileState.updateCareerStage(stage)
                                    }
                                }
                            } label: {
                                menuLabelText(profileState.profile.careerStage.rawValue)
                            }
                        }
                    }

                    profileCard(
                        title: "Industry vs academia",
                        subtitle: "Tell Peer how to prioritize opportunities.",
                        icon: "building.2"
                    ) {
                        inputShell {
                            Menu {
                                ForEach(UserProfile.IndustryAcademiaPreference.allCases, id: \.self) { preference in
                                    Button(preference.rawValue.capitalized) {
                                        profileState.updateIndustryPreference(preference)
                                    }
                                }
                            } label: {
                                menuLabelText(profileState.profile.industryVsAcademia.rawValue.capitalized)
                            }
                        }
                    }

                    profileCard(
                        title: "Location preferences",
                        subtitle: "Examples: Remote, Bay Area, Europe.",
                        icon: "mappin.and.ellipse"
                    ) {
                        inputShell {
                            TextField("Preferred locations", text: $locationsText)
                                .textFieldStyle(.plain)
                                .font(PeerTheme.bodyFont(PeerTheme.callout))
                                .foregroundColor(PeerTheme.textPrimary)
                                .onChange(of: locationsText) { _, newValue in
                                    let list = newValue
                                        .split(separator: ",")
                                        .map { String($0.trimmingCharacters(in: .whitespaces)) }
                                        .filter { !$0.isEmpty }
                                    profileState.updateLocations(list)
                                }
                        }
                    }

                    profileCard(
                        title: "Preferred methods",
                        subtitle: "Examples: RL, diffusion models, NLP.",
                        icon: "brain.head.profile"
                    ) {
                        inputShell {
                            TextField("Preferred methods", text: $methodsText)
                                .textFieldStyle(.plain)
                                .font(PeerTheme.bodyFont(PeerTheme.callout))
                                .foregroundColor(PeerTheme.textPrimary)
                                .onChange(of: methodsText) { _, newValue in
                                    let list = newValue
                                        .split(separator: ",")
                                        .map { String($0.trimmingCharacters(in: .whitespaces)) }
                                        .filter { !$0.isEmpty }
                                    profileState.updateMethods(list)
                                }
                        }
                    }
                }
                .padding(.horizontal, PeerTheme.horizontalPadding)
                .padding(.top, 12)
                .padding(.bottom, 30)
            }
            .navigationTitle("Profile")
            .navigationBarTitleDisplayMode(.inline)
            .peerScreenBackground()
            .onAppear {
                userNameText = profileState.profile.displayName
                researchTopicsText = profileState.profile.researchTopics.joined(separator: ", ")
                let existingVenue = profileState.profile.preferredVenues.first ?? "No preference"
                selectedVenue = venueOptions.contains(existingVenue) ? existingVenue : "No preference"
                locationsText = profileState.profile.locationPreferences.joined(separator: ", ")
                methodsText = profileState.profile.preferredMethods.joined(separator: ", ")
            }
            .confirmationDialog("Log out from Peer?", isPresented: $showLogoutConfirmation, titleVisibility: .visible) {
                Button("Log Out", role: .destructive) {
                    profileState.logOut()
                    userNameText = profileState.profile.displayName
                    researchTopicsText = ""
                    selectedVenue = "No preference"
                    locationsText = ""
                    methodsText = ""
                }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("Your local personalization settings will reset to defaults.")
            }
        }
    }

    private var profileHeroCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            PeerMosaicView(
                seed: userNameText.isEmpty ? "Peer Member" : userNameText,
                height: 120,
                imageURLs: PeerImageLibrary.profile(seed: userNameText.isEmpty ? "Peer Member" : userNameText)
            )

            VStack(alignment: .leading, spacing: 4) {
                Text("Hello, \(userNameText)")
                    .font(PeerTheme.titleFont(28, weight: .bold))
                    .foregroundColor(PeerTheme.textPrimary)
                Text("Personalize your daily paper, event, and job recommendations.")
                    .font(PeerTheme.bodyFont(PeerTheme.caption))
                    .foregroundColor(PeerTheme.textSecondary)
            }

            HStack(spacing: 8) {
                CardMetaPill(text: profileState.profile.careerStage.rawValue, icon: "person.fill")
                CardMetaPill(text: profileState.profile.industryVsAcademia.rawValue.capitalized, icon: "sparkles")
            }
        }
        .padding(12)
        .peerCardSurface(cornerRadius: 24)
    }

    private var accountCard: some View {
        profileCard(title: "Account", subtitle: "Identity and session controls.", icon: "person.crop.circle") {
            HStack(alignment: .center, spacing: 12) {
                ZStack {
                    Circle()
                        .fill(PeerTheme.accentCoral)
                    Text(initials(from: userNameText))
                        .font(PeerTheme.titleFont(22, weight: .bold))
                        .foregroundColor(.white)
                }
                .frame(width: 60, height: 60)

                VStack(alignment: .leading, spacing: 8) {
                    Text("Display name")
                        .font(PeerTheme.bodyFont(12, weight: .semibold))
                        .foregroundColor(PeerTheme.sectionLabel)
                    inputShell {
                        TextField("Your name", text: $userNameText)
                            .textFieldStyle(.plain)
                            .font(PeerTheme.bodyFont(PeerTheme.callout, weight: .semibold))
                            .foregroundColor(PeerTheme.textPrimary)
                            .onChange(of: userNameText) { _, newValue in
                                profileState.updateDisplayName(newValue)
                                if newValue.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                                    userNameText = profileState.profile.displayName
                                }
                            }
                    }
                }
            }

            HStack {
                Spacer(minLength: 0)
                Button(role: .destructive) {
                    showLogoutConfirmation = true
                } label: {
                    Label("Log Out", systemImage: "rectangle.portrait.and.arrow.right")
                        .font(PeerTheme.bodyFont(13, weight: .semibold))
                        .foregroundColor(PeerTheme.accentDismiss)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 7)
                        .background(PeerTheme.accentDismissLight)
                        .clipShape(Capsule())
                        .overlay(
                            Capsule()
                                .strokeBorder(PeerTheme.divider, lineWidth: 0.8)
                        )
                }
            }
            .padding(.top, 4)
        }
    }

    private var agentContextCard: some View {
        profileCard(
            title: "Agent context",
            subtitle: "Signals currently used for recommendation reasoning.",
            icon: "sparkles.rectangle.stack"
        ) {
            VStack(alignment: .leading, spacing: 10) {
                contextRow("Career goal", value: profileState.profile.industryVsAcademia.rawValue.capitalized)
                contextRow("Career stage", value: profileState.profile.careerStage.rawValue)
                contextRow(
                    "Preferred methods",
                    value: profileState.profile.preferredMethods.isEmpty
                        ? "Not set yet"
                        : profileState.profile.preferredMethods.joined(separator: ", ")
                )
            }
        }
    }

    private func profileCard<Content: View>(
        title: String,
        subtitle: String? = nil,
        icon: String,
        @ViewBuilder content: () -> Content
    ) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top, spacing: 10) {
                Image(systemName: icon)
                    .font(.system(size: 14, weight: .bold))
                    .foregroundColor(PeerTheme.textPrimary)
                    .frame(width: 30, height: 30)
                    .background(Color.black.opacity(0.05))
                    .clipShape(RoundedRectangle(cornerRadius: 9))
                VStack(alignment: .leading, spacing: 3) {
                    Text(title)
                        .font(PeerTheme.titleFont(19, weight: .bold))
                        .foregroundColor(PeerTheme.sectionHeader)
                    if let subtitle, !subtitle.isEmpty {
                        Text(subtitle)
                            .font(PeerTheme.bodyFont(PeerTheme.caption))
                            .foregroundColor(PeerTheme.sectionLabel)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
            }
            content()
        }
        .padding(18)
        .peerCardSurface(cornerRadius: 20)
    }

    private func inputShell<Content: View>(@ViewBuilder content: () -> Content) -> some View {
        content()
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
            .background(Color.white)
            .clipShape(RoundedRectangle(cornerRadius: 14))
            .overlay(
                RoundedRectangle(cornerRadius: 14)
                    .strokeBorder(PeerTheme.divider, lineWidth: 1)
            )
    }

    private func menuLabelText(_ value: String) -> some View {
        HStack {
            Text(value)
                .font(PeerTheme.bodyFont(PeerTheme.callout, weight: .semibold))
                .foregroundColor(PeerTheme.textPrimary)
            Spacer(minLength: 0)
            Image(systemName: "chevron.down")
                .font(.system(size: 12, weight: .semibold))
                .foregroundColor(PeerTheme.sectionLabel)
        }
    }

    private func contextRow(_ title: String, value: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title.uppercased())
                .font(PeerTheme.bodyFont(11, weight: .bold))
                .foregroundColor(PeerTheme.sectionLabel)
            Text(value)
                .font(PeerTheme.bodyFont(PeerTheme.callout))
                .foregroundColor(PeerTheme.textPrimary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(Color.black.opacity(0.03))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    private func initials(from name: String) -> String {
        let parts = name
            .split(separator: " ")
            .map(String.init)
            .filter { !$0.isEmpty }
        if let first = parts.first?.first, let second = parts.dropFirst().first?.first {
            return String(first).uppercased() + String(second).uppercased()
        }
        if let first = parts.first?.first {
            return String(first).uppercased()
        }
        return "H"
    }
}

#Preview {
    ProfileView()
        .environmentObject(ProfileState())
}
