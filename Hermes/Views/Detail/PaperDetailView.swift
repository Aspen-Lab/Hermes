//
//  PaperDetailView.swift
//  Hermes
//

import SwiftUI

struct PaperDetailView: View {
    let paper: Paper
    @EnvironmentObject var feedState: FeedState
    @Environment(\.openURL) private var openURL

    private var primaryURL: URL? {
        paper.linkCode ?? paper.linkPaper ?? paper.linkArxiv ?? paper.linkScholar
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                HermesMosaicView(
                    seed: paper.id,
                    height: 180,
                    imageURLs: HermesImageLibrary.paper(seed: paper.id)
                )

                VStack(alignment: .leading, spacing: 10) {
                    Text(paper.title)
                        .font(HermesTheme.titleFont(32, weight: .bold))
                        .foregroundColor(HermesTheme.textPrimary)
                        .fixedSize(horizontal: false, vertical: true)
                    Text(paper.authors.joined(separator: ", "))
                        .font(HermesTheme.bodyFont(HermesTheme.callout))
                        .foregroundColor(HermesTheme.textSecondary)
                    HStack(spacing: 8) {
                        CardMetaPill(text: paper.venue, icon: "graduationcap.fill")
                        CardMetaPill(text: paper.source.rawValue.uppercased(), icon: "doc.text")
                    }
                }

                sectionCard(
                    title: "Why this fits you",
                    content: paper.relevanceReason,
                    icon: "sparkles"
                )

                sectionCard(
                    title: "Intro",
                    content: limitedToThreeSentences(paper.summaryIntro),
                    icon: "text.book.closed"
                )

                VStack(alignment: .leading, spacing: 10) {
                    Label("Experiment Keywords", systemImage: "flask")
                        .font(HermesTheme.titleFont(18, weight: .bold))
                        .foregroundColor(HermesTheme.sectionHeader)
                    FlowTagView(tags: paper.summaryExperimentKeywords)
                }
                .padding(18)
                .hermesCardSurface(cornerRadius: 16)

                sectionCard(
                    title: "Result and Discussion",
                    content: limitedToThreeSentences(paper.summaryResultDiscussion),
                    icon: "chart.bar.xaxis"
                )

                linksSection

                FeedCardActionsView(
                    onSave: { feedState.savePaper(paper) },
                    onNotInterested: { feedState.notInterestedPaper(paper) },
                    onMoreLikeThis: { feedState.moreLikePaper(paper) }
                )
                .padding(16)
                .hermesCardSurface(cornerRadius: 16)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(HermesTheme.horizontalPadding)
            .padding(.top, 12)
            .padding(.bottom, 28)
        }
        .navigationBarTitleDisplayMode(.inline)
        .hermesScreenBackground()
        .safeAreaInset(edge: .bottom) {
            HermesStickyCTA(buttonTitle: primaryURL == nil ? "No Link Available" : "Open Best Link") {
                if let primaryURL {
                    openURL(primaryURL)
                }
            } leading: {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Paper Resources")
                        .font(HermesTheme.bodyFont(13, weight: .semibold))
                        .foregroundColor(HermesTheme.textPrimary)
                    Text("Paper, arXiv, Scholar, and Code")
                        .font(HermesTheme.bodyFont(12))
                        .foregroundColor(HermesTheme.textSecondary)
                }
            }
        }
    }

    private func sectionCard(title: String, content: String, icon: String) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Label(title, systemImage: icon)
                .font(HermesTheme.titleFont(18, weight: .bold))
                .foregroundColor(HermesTheme.sectionHeader)
            Text(content)
                .font(HermesTheme.bodyFont(HermesTheme.callout))
                .foregroundColor(HermesTheme.textPrimary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(18)
        .hermesCardSurface(cornerRadius: 16)
    }

    private var linksSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Links")
                .font(HermesTheme.titleFont(18, weight: .bold))
                .foregroundColor(HermesTheme.sectionHeader)

            linkRow("Paper", url: paper.linkPaper)
            linkRow("arXiv", url: paper.linkArxiv)
            linkRow("Google Scholar", url: paper.linkScholar)
            linkRow("Code", url: paper.linkCode)
        }
        .padding(18)
        .hermesCardSurface(cornerRadius: 16)
    }

    private func linkRow(_ label: String, url: URL?) -> some View {
        Group {
            if let url {
                Link(destination: url) {
                    HStack {
                        Text(label)
                            .font(HermesTheme.bodyFont(15, weight: .semibold))
                            .foregroundColor(HermesTheme.textPrimary)
                        Spacer()
                        Image(systemName: "arrow.up.right")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundColor(HermesTheme.primaryLight)
                    }
                    .padding(.horizontal, 14)
                    .padding(.vertical, 12)
                    .background(Color.black.opacity(0.03))
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                }
            }
        }
    }

    private func limitedToThreeSentences(_ text: String) -> String {
        let pieces = text
            .split(whereSeparator: { [".", "!", "?"].contains($0) })
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
        guard !pieces.isEmpty else { return text }
        return pieces.prefix(3).joined(separator: ". ") + "."
    }
}

private struct FlowTagView: View {
    let tags: [String]

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            if tags.isEmpty {
                Text("No experiment keywords available.")
                    .font(HermesTheme.bodyFont(HermesTheme.caption))
                    .foregroundColor(HermesTheme.textSecondary)
            } else {
                ForEach(tags.chunked(into: 3), id: \.self) { row in
                    HStack(spacing: 8) {
                        ForEach(row, id: \.self) { item in
                            Text(item)
                                .font(HermesTheme.bodyFont(HermesTheme.captionSmall, weight: .semibold))
                                .foregroundColor(HermesTheme.primaryLight)
                                .padding(.horizontal, 10)
                                .padding(.vertical, 7)
                                .background(Color.black.opacity(0.04))
                                .clipShape(Capsule())
                        }
                        Spacer(minLength: 0)
                    }
                }
            }
        }
    }
}

private extension Array {
    func chunked(into size: Int) -> [[Element]] {
        guard size > 0 else { return [self] }
        return stride(from: 0, to: count, by: size).map {
            Array(self[$0 ..< Swift.min($0 + size, count)])
        }
    }
}

#Preview {
    NavigationStack {
        PaperDetailView(paper: RecommendationService.mockPapers().first!)
            .environmentObject(FeedState())
            .environmentObject(ProfileState())
    }
}
