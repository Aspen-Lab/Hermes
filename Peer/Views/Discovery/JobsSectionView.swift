//
//  JobsSectionView.swift
//  Peer
//

import SwiftUI

struct JobsSectionView: View {
    let jobs: [Job]
    @EnvironmentObject var feedState: FeedState

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            ForEach(jobs) { job in
                NavigationLink(value: job) {
                    JobCardView(job: job)
                }
                .buttonStyle(.plain)
            }
        }
    }
}

struct JobCardView: View {
    let job: Job
    @EnvironmentObject var feedState: FeedState

    var body: some View {
        FeedCardView {
            VStack(alignment: .leading, spacing: 12) {
                PeerMosaicView(
                    seed: job.id,
                    height: 116,
                    imageURLs: PeerImageLibrary.job(seed: job.id)
                )

                VStack(alignment: .leading, spacing: 8) {
                    Text(job.roleTitle)
                        .font(PeerTheme.titleFont(20, weight: .bold))
                        .foregroundColor(PeerTheme.textPrimary)
                        .lineLimit(2)

                    Text(job.companyOrLab)
                        .font(PeerTheme.bodyFont(PeerTheme.callout))
                        .foregroundColor(PeerTheme.textSecondary)

                    CardMetaPill(text: job.isRemote ? "Remote" : job.location, icon: "mappin.and.ellipse")
                }

                CardRationaleView(title: "Why this is a match", reason: job.matchReason)

                FeedCardActionsView(
                    onSave: { feedState.saveJob(job) },
                    onNotInterested: { feedState.notInterestedJob(job) },
                    onMoreLikeThis: nil,
                    showMoreLikeThis: false
                )
            }
        }
    }
}
