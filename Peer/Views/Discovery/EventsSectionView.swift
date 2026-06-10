//
//  EventsSectionView.swift
//  Peer
//

import SwiftUI

struct EventsSectionView: View {
    let events: [Event]
    @EnvironmentObject var feedState: FeedState

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            ForEach(events) { event in
                NavigationLink(value: event) {
                    EventCardView(event: event)
                }
                .buttonStyle(.plain)
            }
        }
    }
}

struct EventCardView: View {
    let event: Event
    @EnvironmentObject var feedState: FeedState

    private var dateText: String {
        let f = DateFormatter()
        f.dateStyle = .medium
        return f.string(from: event.date)
    }

    var body: some View {
        FeedCardView {
            VStack(alignment: .leading, spacing: 12) {
                PeerMosaicView(
                    seed: event.id,
                    height: 116,
                    imageURLs: PeerImageLibrary.event(seed: event.id)
                )

                VStack(alignment: .leading, spacing: 8) {
                    Text(event.name)
                        .font(PeerTheme.titleFont(20, weight: .bold))
                        .foregroundColor(PeerTheme.textPrimary)
                        .lineLimit(3)

                    HStack(spacing: 7) {
                        CardMetaPill(text: event.type.rawValue.capitalized, icon: "calendar")
                        CardMetaPill(text: dateText, icon: "clock")
                    }

                    CardMetaPill(text: event.isOnline ? "Online" : event.location, icon: "mappin.and.ellipse")

                    Text(event.shortDescription)
                        .font(PeerTheme.bodyFont(PeerTheme.caption))
                        .foregroundColor(PeerTheme.textSecondary)
                        .lineLimit(2)
                }

                CardRationaleView(title: "Why this is relevant", reason: event.relevanceReason)

                FeedCardActionsView(
                    onSave: { feedState.saveEvent(event) },
                    onNotInterested: { feedState.notInterestedEvent(event) },
                    onMoreLikeThis: nil,
                    showMoreLikeThis: false
                )
            }
        }
    }
}
