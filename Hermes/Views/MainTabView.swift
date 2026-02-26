//
//  MainTabView.swift
//  Hermes
//

import SwiftUI

struct MainTabView: View {
    @State private var selectedTab = 0

    var body: some View {
        TabView(selection: $selectedTab) {
            DiscoveryView()
                .tabItem {
                    Label("Discovery", systemImage: "sparkles")
                }
                .tag(0)

            ProfileView()
                .tabItem {
                    Label("Profile", systemImage: "person.crop.circle")
                }
                .tag(1)
        }
        .tint(HermesTheme.primary)
        .toolbarBackground(HermesTheme.backgroundElevated, for: .tabBar)
        .toolbarBackground(.visible, for: .tabBar)
    }
}

#Preview {
    MainTabView()
        .environmentObject(FeedState())
        .environmentObject(ProfileState())
}
