//
//  PapersSectionView.swift
//  Hermes
//

import SwiftUI

struct PapersSectionView: View {
    let papers: [Paper]
    @EnvironmentObject var feedState: FeedState

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            ForEach(papers) { paper in
                NavigationLink(value: paper) {
                    PaperCardView(paper: paper)
                }
                .buttonStyle(.plain)
            }
        }
    }
}

struct PaperCardView: View {
    let paper: Paper
    @EnvironmentObject var feedState: FeedState

    var body: some View {
        FeedCardView {
            VStack(alignment: .leading, spacing: 12) {
                HermesMosaicView(
                    seed: paper.id,
                    height: 116,
                    imageURLs: HermesImageLibrary.paper(seed: paper.id)
                )
                    .overlay(alignment: .topTrailing) {
                        if paper.isSaved {
                            Image(systemName: "bookmark.fill")
                                .font(.system(size: 14, weight: .bold))
                                .foregroundColor(.white)
                                .padding(10)
                                .background(HermesTheme.accentCoral)
                                .clipShape(Circle())
                                .padding(10)
                        }
                    }

                VStack(alignment: .leading, spacing: 8) {
                    Text(paper.title)
                        .font(HermesTheme.titleFont(20, weight: .bold))
                        .foregroundColor(HermesTheme.textPrimary)
                        .lineLimit(3)

                    Text(paper.authors.joined(separator: ", "))
                        .font(HermesTheme.bodyFont(HermesTheme.caption))
                        .foregroundColor(HermesTheme.textSecondary)
                        .lineLimit(1)

                    HStack(spacing: 7) {
                        CardMetaPill(text: paper.venue, icon: "graduationcap.fill")
                        CardMetaPill(text: paper.source.rawValue.uppercased(), icon: "doc.text")
                    }
                }

                CardRationaleView(title: "Why this is relevant", reason: paper.relevanceReason)

                FeedCardActionsView(
                    onSave: { feedState.savePaper(paper) },
                    onNotInterested: { feedState.notInterestedPaper(paper) },
                    onMoreLikeThis: { feedState.moreLikePaper(paper) }
                )
            }
        }
    }
}
