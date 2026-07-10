//
//  PeerApp.swift
//  Peer
//
//  Agent-powered personalized recommendations for PhD students.
//00

import SwiftUI
import UIKit

@main
struct PeerApp: App {
    @StateObject private var feedState = FeedState()
    @StateObject private var profileState = ProfileState()

    init() {
        let navAppearance = UINavigationBarAppearance()
        navAppearance.configureWithTransparentBackground()
        navAppearance.backgroundColor = UIColor(PeerTheme.backgroundElevated.opacity(0.92))
        navAppearance.titleTextAttributes = [.foregroundColor: UIColor(PeerTheme.textPrimary)]
        navAppearance.largeTitleTextAttributes = [.foregroundColor: UIColor(PeerTheme.textPrimary)]
        UINavigationBar.appearance().standardAppearance = navAppearance
        UINavigationBar.appearance().scrollEdgeAppearance = navAppearance

        let tabAppearance = UITabBarAppearance()
        tabAppearance.configureWithDefaultBackground()
        tabAppearance.backgroundColor = UIColor(PeerTheme.backgroundElevated.opacity(0.96))
        UITabBar.appearance().standardAppearance = tabAppearance
        UITabBar.appearance().scrollEdgeAppearance = tabAppearance
    }

    var body: some Scene {
        WindowGroup {
            MainTabView()
                .environmentObject(feedState)
                .environmentObject(profileState)
        }
    }
}
