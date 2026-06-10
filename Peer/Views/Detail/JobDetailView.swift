//
//  JobDetailView.swift
//  Peer
//

import SwiftUI

struct JobDetailView: View {
    let job: Job
    @EnvironmentObject var feedState: FeedState
    @Environment(\.openURL) private var openURL

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                PeerMosaicView(
                    seed: job.id,
                    height: 180,
                    imageURLs: PeerImageLibrary.job(seed: job.id)
                )

                VStack(alignment: .leading, spacing: 10) {
                    Text(job.roleTitle)
                        .font(PeerTheme.titleFont(32, weight: .bold))
                        .foregroundColor(PeerTheme.textPrimary)
                        .fixedSize(horizontal: false, vertical: true)
                    Text(job.companyOrLab)
                        .font(PeerTheme.bodyFont(18, weight: .medium))
                        .foregroundColor(PeerTheme.textSecondary)
                    CardMetaPill(text: job.isRemote ? "Remote" : job.location, icon: "mappin.and.ellipse")
                }

                sectionCard(
                    title: "Why this is a match",
                    content: job.matchReason,
                    icon: "sparkles"
                )

                VStack(alignment: .leading, spacing: 10) {
                    Label("What you'll need", systemImage: "checkmark.circle")
                        .font(PeerTheme.titleFont(18, weight: .bold))
                        .foregroundColor(PeerTheme.sectionHeader)

                    ForEach(job.keyRequirements, id: \.self) { requirement in
                        HStack(alignment: .top, spacing: 8) {
                            Image(systemName: "smallcircle.filled.circle.fill")
                                .font(.system(size: 8))
                                .foregroundColor(PeerTheme.primaryLight)
                                .padding(.top, 5)
                            Text(requirement)
                                .font(PeerTheme.bodyFont(PeerTheme.callout))
                                .foregroundColor(PeerTheme.textPrimary)
                        }
                    }
                }
                .padding(18)
                .peerCardSurface(cornerRadius: 16)

                FeedCardActionsView(
                    onSave: { feedState.saveJob(job) },
                    onNotInterested: { feedState.notInterestedJob(job) },
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
            PeerStickyCTA(buttonTitle: job.linkPosting == nil ? "No Link Available" : "Apply Now") {
                if let jobURL = job.linkPosting {
                    openURL(jobURL)
                }
            } leading: {
                VStack(alignment: .leading, spacing: 2) {
                    Text(job.companyOrLab)
                        .font(PeerTheme.bodyFont(13, weight: .semibold))
                        .foregroundColor(PeerTheme.textPrimary)
                    Text(job.isRemote ? "Remote role" : job.location)
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
}
