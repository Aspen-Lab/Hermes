//
//  Job.swift
//  Hermes
//

import Foundation

struct Job: Identifiable, Codable, Hashable {
    let id: String
    var roleTitle: String
    var companyOrLab: String
    var location: String
    var isRemote: Bool
    var keyRequirements: [String]
    var matchReason: String
    var linkPosting: URL?
    var postedDate: Date?
}
