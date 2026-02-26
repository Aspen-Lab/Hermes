//
//  HermesApp.swift
//  Hermes
//
//  Agent-powered personalized recommendations for PhD students.
//

import SwiftUI
import UIKit

@main
struct HermesApp: App {
    @StateObject private var feedState = FeedState()
    @StateObject private var profileState = ProfileState()

    init() {
        let navAppearance = UINavigationBarAppearance()
        navAppearance.configureWithTransparentBackground()
        navAppearance.backgroundColor = UIColor(HermesTheme.backgroundElevated.opacity(0.92))
        navAppearance.titleTextAttributes = [.foregroundColor: UIColor(HermesTheme.textPrimary)]
        navAppearance.largeTitleTextAttributes = [.foregroundColor: UIColor(HermesTheme.textPrimary)]
        UINavigationBar.appearance().standardAppearance = navAppearance
        UINavigationBar.appearance().scrollEdgeAppearance = navAppearance

        let tabAppearance = UITabBarAppearance()
        tabAppearance.configureWithDefaultBackground()
        tabAppearance.backgroundColor = UIColor(HermesTheme.backgroundElevated.opacity(0.96))
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
