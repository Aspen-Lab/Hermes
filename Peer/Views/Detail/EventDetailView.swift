//
//  EventDetailView.swift
//  Peer
//

import SwiftUI

struct EventDetailView: View {
    let event: Event
    @EnvironmentObject var feedState: FeedState
    @Environment(\.openURL) private var openURL

    private var dateText: String {
        let f = DateFormatter()
        f.dateStyle = .long
        return f.string(from: event.date)
    }

    private var primaryURL: URL? {
        event.linkRegistration ?? event.linkOfficial
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                PeerMosaicView(
                    seed: event.id,
                    height: 180,
                    imageURLs: PeerImageLibrary.event(seed: event.id)
                )

                VStack(alignment: .leading, spacing: 10) {
                    Text(event.name)
                        .font(PeerTheme.titleFont(32, weight: .bold))
                        .foregroundColor(PeerTheme.textPrimary)
                        .fixedSize(horizontal: false, vertical: true)

                    HStack(spacing: 8) {
                        CardMetaPill(text: event.type.rawValue.capitalized, icon: "calendar")
                        CardMetaPill(text: dateText, icon: "clock")
                    }
                    CardMetaPill(text: event.isOnline ? "Online" : event.location, icon: "mappin.and.ellipse")
                }

                sectionCard(
                    title: "Why this fits you",
                    content: event.relevanceReason,
                    icon: "sparkles"
                )

                sectionCard(
                    title: "What you'll do",
                    content: event.shortDescription,
                    icon: "list.bullet.rectangle.portrait"
                )

                if let deadline = event.deadline {
                    sectionCard(
                        title: "Deadline",
                        content: deadline.formatted(date: .long, time: .omitted),
                        icon: "alarm"
                    )
                }

                linksSection

                FeedCardActionsView(
                    onSave: { feedState.saveEvent(event) },
                    onNotInterested: { feedState.notInterestedEvent(event) },
                    onMoreLikeThis: nil,
                    showMoreLikeThis: false
                )
                .padding(16)
                .peerCardSurface(cornerRadius: 16)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(PeerTheme.horizontalPadding)
            .padding(.top, 12)
            .padding(.bottom, 28)
        }
        .navigationBarTitleDisplayMode(.inline)
        .peerScreenBackground()
        .safeAreaInset(edge: .bottom) {
            PeerStickyCTA(buttonTitle: primaryURL == nil ? "No Link Available" : "Show Dates") {
                if let primaryURL {
                    openURL(primaryURL)
                }
            } leading: {
                VStack(alignment: .leading, spacing: 2) {
                    Text(event.type.rawValue.capitalized)
                        .font(PeerTheme.bodyFont(13, weight: .semibold))
                        .foregroundColor(PeerTheme.textPrimary)
                    Text(event.isOnline ? "Online event" : event.location)
                        .font(PeerTheme.bodyFont(12))
                        .foregroundColor(PeerTheme.textSecondary)
                }
            }
        }
    }

    private func sectionCard(title: String, content: String, icon: String) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Label(title, systemImage: icon)
                .font(PeerTheme.titleFont(18, weight: .bold))
                .foregroundColor(PeerTheme.sectionHeader)
            Text(content)
                .font(PeerTheme.bodyFont(PeerTheme.callout))
                .foregroundColor(PeerTheme.textPrimary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(18)
        .peerCardSurface(cornerRadius: 16)
    }

    private var linksSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Links")
                .font(PeerTheme.titleFont(18, weight: .bold))
                .foregroundColor(PeerTheme.sectionHeader)

            if let url = event.linkOfficial {
                linkRow("Official Site", url: url)
            }
            if let url = event.linkRegistration {
                linkRow("Registration", url: url)
            }
        }
        .padding(18)
        .peerCardSurface(cornerRadius: 16)
    }

    private func linkRow(_ label: String, url: URL) -> some View {
        Link(destination: url) {
            HStack {
                Text(label)
                    .font(PeerTheme.bodyFont(15, weight: .semibold))
                    .foregroundColor(PeerTheme.textPrimary)
                Spacer()
                Image(systemName: "arrow.up.right")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundColor(PeerTheme.primaryLight)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
            .background(Color.black.opacity(0.03))
            .clipShape(RoundedRectangle(cornerRadius: 12))
        }
    }
}
