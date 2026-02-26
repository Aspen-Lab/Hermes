//
//  Paper.swift
//  Hermes
//

import Foundation

struct Paper: Identifiable, Codable, Hashable {
    let id: String
    var title: String
    var authors: [String]
    var relevanceReason: String
    var venue: String
    var source: PaperSource
    var summaryIntro: String
    var summaryExperimentKeywords: [String]
    var summaryResultDiscussion: String
    var linkPaper: URL?
    var linkArxiv: URL?
    var linkScholar: URL?
    var linkCode: URL?
    var publishedDate: Date?
    var isSaved: Bool
    var feedback: ItemFeedback?

    enum PaperSource: String, Codable, CaseIterable {
        case arxiv
        case neurIPS
        case iclr
        case icml
        case chi
        case other
    }

    static let paperSource = PaperSource.self
}

enum ItemFeedback: String, Codable {
    case liked
    case saved
    case notInterested
    case moreLikeThis
}

typealias PaperSource = Paper.PaperSource
