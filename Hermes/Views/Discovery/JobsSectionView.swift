//
//  JobsSectionView.swift
//  Hermes
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
                HermesMosaicView(
                    seed: job.id,
                    height: 116,
                    imageURLs: HermesImageLibrary.job(seed: job.id)
                )

                VStack(alignment: .leading, spacing: 8) {
                    Text(job.roleTitle)
                        .font(HermesTheme.titleFont(20, weight: .bold))
                        .foregroundColor(HermesTheme.textPrimary)
                        .lineLimit(2)

                    Text(job.companyOrLab)
                        .font(HermesTheme.bodyFont(HermesTheme.callout))
                        .foregroundColor(HermesTheme.textSecondary)

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
