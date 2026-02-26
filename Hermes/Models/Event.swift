//
//  Event.swift
//  Hermes
//

import Foundation

struct Event: Identifiable, Codable, Hashable {
    let id: String
    var name: String
    var type: EventType
    var date: Date
    var endDate: Date?
    var location: String
    var isOnline: Bool
    var deadline: Date?
    var shortDescription: String
    var relevanceReason: String
    var linkRegistration: URL?
    var linkOfficial: URL?

    enum EventType: String, Codable, CaseIterable {
        case conference
        case workshop
        case seminar
        case meetup
    }
}
