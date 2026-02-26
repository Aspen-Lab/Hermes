//
//  JobDetailView.swift
//  Hermes
//

import SwiftUI

struct JobDetailView: View {
    let job: Job
    @EnvironmentObject var feedState: FeedState
    @Environment(\.openURL) private var openURL

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                HermesMosaicView(
                    seed: job.id,
                    height: 180,
                    imageURLs: HermesImageLibrary.job(seed: job.id)
                )

                VStack(alignment: .leading, spacing: 10) {
                    Text(job.roleTitle)
                        .font(HermesTheme.titleFont(32, weight: .bold))
                        .foregroundColor(HermesTheme.textPrimary)
                        .fixedSize(horizontal: false, vertical: true)
                    Text(job.companyOrLab)
                        .font(HermesTheme.bodyFont(18, weight: .medium))
                        .foregroundColor(HermesTheme.textSecondary)
                    CardMetaPill(text: job.isRemote ? "Remote" : job.location, icon: "mappin.and.ellipse")
                }

                sectionCard(
                    title: "Why this is a match",
                    content: job.matchReason,
                    icon: "sparkles"
                )

                VStack(alignment: .leading, spacing: 10) {
                    Label("What you'll need", systemImage: "checkmark.circle")
                        .font(HermesTheme.titleFont(18, weight: .bold))
                        .foregroundColor(HermesTheme.sectionHeader)

                    ForEach(job.keyRequirements, id: \.self) { requirement in
                        HStack(alignment: .top, spacing: 8) {
                            Image(systemName: "smallcircle.filled.circle.fill")
                                .font(.system(size: 8))
                                .foregroundColor(HermesTheme.primaryLight)
                                .padding(.top, 5)
                            Text(requirement)
                                .font(HermesTheme.bodyFont(HermesTheme.callout))
                                .foregroundColor(HermesTheme.textPrimary)
                        }
                    }
                }
                .padding(18)
                .hermesCardSurface(cornerRadius: 16)

                FeedCardActionsView(
                    onSave: { feedState.saveJob(job) },
                    onNotInterested: { feedState.notInterestedJob(job) },
                    onMoreLikeThis: nil,
                    showMoreLikeThis: false
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
            HermesStickyCTA(buttonTitle: job.linkPosting == nil ? "No Link Available" : "Apply Now") {
                if let jobURL = job.linkPosting {
                    openURL(jobURL)
                }
            } leading: {
                VStack(alignment: .leading, spacing: 2) {
                    Text(job.companyOrLab)
                        .font(HermesTheme.bodyFont(13, weight: .semibold))
                        .foregroundColor(HermesTheme.textPrimary)
                    Text(job.isRemote ? "Remote role" : job.location)
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
}
