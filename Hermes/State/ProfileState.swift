//
//  ProfileState.swift
//  Hermes
//

import Foundation
import Combine

final class ProfileState: ObservableObject {
    @Published var profile: UserProfile

    private let storageKey = "hermes_user_profile"
    private let defaults = UserDefaults.standard

    init() {
        if let data = defaults.data(forKey: storageKey),
           let decoded = try? JSONDecoder().decode(UserProfile.self, from: data) {
            profile = decoded
        } else {
            profile = .defaultProfile
        }
    }

    func save() {
        guard let data = try? JSONEncoder().encode(profile) else { return }
        defaults.set(data, forKey: storageKey)
    }

    func updateTopics(_ topics: [String]) {
        profile.researchTopics = topics
        save()
    }

    func updateDisplayName(_ name: String) {
        profile.displayName = name.trimmingCharacters(in: .whitespacesAndNewlines)
        if profile.displayName.isEmpty {
            profile.displayName = "Hermes Member"
        }
        save()
    }

    func updateVenues(_ venues: [String]) {
        profile.preferredVenues = venues
        save()
    }

    func updateCareerStage(_ stage: UserProfile.CareerStage) {
        profile.careerStage = stage
        save()
    }

    func updateIndustryPreference(_ pref: UserProfile.IndustryAcademiaPreference) {
        profile.industryVsAcademia = pref
        save()
    }

    func updateLocations(_ locations: [String]) {
        profile.locationPreferences = locations
        save()
    }

    func updateMethods(_ methods: [String]) {
        profile.preferredMethods = methods
        save()
    }

    func logOut() {
        defaults.removeObject(forKey: storageKey)
        profile = .defaultProfile
    }
}
