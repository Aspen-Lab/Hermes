//
//  UserProfile.swift
//  Hermes
//

import Foundation

struct UserProfile: Codable {
    var displayName: String
    var researchTopics: [String]
    var preferredVenues: [String]
    var careerStage: CareerStage
    var industryVsAcademia: IndustryAcademiaPreference
    var locationPreferences: [String]
    var preferredMethods: [String]
    var phdYear: Int?

    enum CareerStage: String, Codable, CaseIterable {
        case phdYear1 = "PhD Year 1"
        case phdYear2 = "PhD Year 2"
        case phdYear3 = "PhD Year 3"
        case phdYear4 = "PhD Year 4"
        case phdYear5 = "PhD Year 5"
        case phdYear6 = "PhD Year 6"
        case postdoc = "Postdoc"
        case researchScientist = "Research Scientist"
    }

    enum IndustryAcademiaPreference: String, Codable, CaseIterable {
        case academia
        case industry
        case both
        case startups
        case bigTech
    }

    enum CodingKeys: String, CodingKey {
        case displayName
        case researchTopics
        case preferredVenues
        case careerStage
        case industryVsAcademia
        case locationPreferences
        case preferredMethods
        case phdYear
    }

    init(
        displayName: String,
        researchTopics: [String],
        preferredVenues: [String],
        careerStage: CareerStage,
        industryVsAcademia: IndustryAcademiaPreference,
        locationPreferences: [String],
        preferredMethods: [String],
        phdYear: Int?
    ) {
        self.displayName = displayName
        self.researchTopics = researchTopics
        self.preferredVenues = preferredVenues
        self.careerStage = careerStage
        self.industryVsAcademia = industryVsAcademia
        self.locationPreferences = locationPreferences
        self.preferredMethods = preferredMethods
        self.phdYear = phdYear
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        displayName = try container.decodeIfPresent(String.self, forKey: .displayName) ?? "Hermes Member"
        researchTopics = try container.decodeIfPresent([String].self, forKey: .researchTopics) ?? []
        preferredVenues = try container.decodeIfPresent([String].self, forKey: .preferredVenues) ?? []
        careerStage = try container.decodeIfPresent(CareerStage.self, forKey: .careerStage) ?? .phdYear3
        industryVsAcademia = try container.decodeIfPresent(IndustryAcademiaPreference.self, forKey: .industryVsAcademia) ?? .both
        locationPreferences = try container.decodeIfPresent([String].self, forKey: .locationPreferences) ?? []
        preferredMethods = try container.decodeIfPresent([String].self, forKey: .preferredMethods) ?? []
        phdYear = try container.decodeIfPresent(Int.self, forKey: .phdYear)
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(displayName, forKey: .displayName)
        try container.encode(researchTopics, forKey: .researchTopics)
        try container.encode(preferredVenues, forKey: .preferredVenues)
        try container.encode(careerStage, forKey: .careerStage)
        try container.encode(industryVsAcademia, forKey: .industryVsAcademia)
        try container.encode(locationPreferences, forKey: .locationPreferences)
        try container.encode(preferredMethods, forKey: .preferredMethods)
        try container.encodeIfPresent(phdYear, forKey: .phdYear)
    }

    static var defaultProfile: UserProfile {
        UserProfile(
            displayName: "Hermes Member",
            researchTopics: [],
            preferredVenues: [],
            careerStage: .phdYear3,
            industryVsAcademia: .both,
            locationPreferences: [],
            preferredMethods: [],
            phdYear: 3
        )
    }
}
