//
//  DiscoveryView.swift
//  Peer
//

import SwiftUI

struct DiscoveryView: View {
    @EnvironmentObject var feedState: FeedState

    private var lastRefreshText: String {
        guard let lastRefresh = feedState.lastRefresh else { return "Not synced yet" }
        let formatter = DateFormatter()
        formatter.dateStyle = .none
        formatter.timeStyle = .short
        return "Last update \(formatter.string(from: lastRefresh))"
    }

    private var savedTotalCount: Int {
        feedState.savedPapers.count + feedState.savedEvents.count + feedState.savedJobs.count
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: PeerTheme.sectionSpacing) {
                    agentBriefingCard

                    RecommendationSectionShell(
                        title: "Recommended Papers",
                        subtitle: "Papers aligned with your active topics, venues, and feedback.",
                        icon: "doc.text.image",
                        count: feedState.papers.count
                    ) {
                        PapersSectionView(papers: feedState.papers)
                    }

                    RecommendationSectionShell(
                        title: "Recommended Events",
                        subtitle: "Conferences, workshops, seminars, and meetups worth tracking early.",
                        icon: "calendar.badge.clock",
                        count: feedState.events.count
                    ) {
                        EventsSectionView(events: feedState.events)
                    }

                    RecommendationSectionShell(
                        title: "Recommended Jobs",
                        subtitle: "Industry, startup, and academic roles matching your goals.",
                        icon: "briefcase.fill",
                        count: feedState.jobs.count
                    ) {
                        JobsSectionView(jobs: feedState.jobs)
                    }

                    if !feedState.isLoading && feedState.papers.isEmpty && feedState.events.isEmpty && feedState.jobs.isEmpty {
                        emptyStateCard
                    }
                }
                .padding(.horizontal, PeerTheme.horizontalPadding)
                .padding(.top, 18)
                .padding(.bottom, 30)
            }
            .navigationTitle("Discover")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    NavigationLink {
                        SavedItemsView()
                            .environmentObject(feedState)
                    } label: {
                        HStack(spacing: 6) {
                            Image(systemName: "bookmark.fill")
                            Text("Saved")
                            if savedTotalCount > 0 {
                                Text("\(savedTotalCount)")
                            }
                        }
                        .font(PeerTheme.bodyFont(12, weight: .semibold))
                        .foregroundColor(PeerTheme.textPrimary)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 7)
                        .background(Color.white)
                        .clipShape(Capsule())
                        .overlay(
                            Capsule()
                                .strokeBorder(PeerTheme.divider, lineWidth: 1)
                        )
                    }
                }
            }
            .refreshable { feedState.loadFeed() }
            .onAppear {
                if feedState.papers.isEmpty && !feedState.isLoading {
                    feedState.loadFeed()
                }
            }
            .peerScreenBackground()
            .overlay {
                if feedState.isLoading && feedState.papers.isEmpty {
                    ZStack {
                        VStack(spacing: 16) {
                            ProgressView()
                                .scaleEffect(1.2)
                                .tint(PeerTheme.primary)
                            Text("Loading recommendations…")
                                .font(PeerTheme.bodyFont(PeerTheme.callout, weight: .medium))
                                .foregroundColor(PeerTheme.textSecondary)
                        }
                        .padding(24)
                        .peerCardSurface()
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                        .padding(.horizontal, PeerTheme.horizontalPadding)
                    }
                }
            }
            .navigationDestination(for: Paper.self) { paper in
                PaperDetailView(paper: paper)
                    .environmentObject(feedState)
            }
            .navigationDestination(for: Event.self) { event in
                EventDetailView(event: event)
                    .environmentObject(feedState)
            }
            .navigationDestination(for: Job.self) { job in
                JobDetailView(job: job)
                    .environmentObject(feedState)
            }
        }
    }

    private var agentBriefingCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 6) {
                    Text("Twice-Daily Agent Briefing")
                        .font(PeerTheme.titleFont(28, weight: .bold))
                        .foregroundColor(PeerTheme.textPrimary)
                    Text("Morning + Night recommendations personalized from your evolving research context.")
                        .font(PeerTheme.bodyFont(PeerTheme.callout))
                        .foregroundColor(PeerTheme.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: 8)
                Image(systemName: "sparkles.rectangle.stack.fill")
                    .font(.system(size: 26))
                    .foregroundStyle(PeerTheme.accentCoral)
            }

            HStack(spacing: 10) {
                capsulePill(text: "Morning Brief", icon: "sun.max.fill")
                capsulePill(text: "Night Brief", icon: "moon.stars.fill")
            }

            Text(lastRefreshText)
                .font(PeerTheme.bodyFont(PeerTheme.caption, weight: .medium))
                .foregroundColor(PeerTheme.sectionLabel)
        }
        .padding(20)
        .peerCardSurface()
    }

    private var emptyStateCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("No recommendations yet")
                .font(PeerTheme.titleFont(18, weight: .bold))
                .foregroundColor(PeerTheme.textPrimary)
            Text("Pull to refresh after setting profile interests so the agents can produce relevant papers, events, and jobs.")
                .font(PeerTheme.bodyFont(PeerTheme.callout))
                .foregroundColor(PeerTheme.textSecondary)
        }
        .padding(18)
        .peerCardSurface(cornerRadius: 16)
    }

    private func capsulePill(text: String, icon: String) -> some View {
        HStack(spacing: 6) {
            Image(systemName: icon)
            Text(text)
        }
        .font(PeerTheme.bodyFont(12, weight: .bold))
        .foregroundColor(PeerTheme.textPrimary)
        .padding(.horizontal, 12)
        .padding(.vertical, 7)
        .background(Color.white)
        .clipShape(Capsule())
        .overlay(
            Capsule()
                .strokeBorder(PeerTheme.divider, lineWidth: 0.8)
        )
    }
}

struct SavedItemsView: View {
    @EnvironmentObject var feedState: FeedState

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: PeerTheme.sectionSpacing) {
                if feedState.savedPapers.isEmpty && feedState.savedEvents.isEmpty && feedState.savedJobs.isEmpty {
                    VStack(alignment: .center, spacing: 12) {
                        Image(systemName: "bookmark.slash")
                            .font(.system(size: 28, weight: .semibold))
                            .foregroundColor(PeerTheme.sectionLabel)
                        Text("No saved recommendations yet")
                            .font(PeerTheme.titleFont(18, weight: .bold))
                            .foregroundColor(PeerTheme.textPrimary)
                        Text("Tap Save on any paper, event, or job from Discovery and it will appear here.")
                            .font(PeerTheme.bodyFont(PeerTheme.callout))
                            .foregroundColor(PeerTheme.textSecondary)
                            .multilineTextAlignment(.center)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(22)
                    .peerCardSurface(cornerRadius: 16)
                }

                if !feedState.savedPapers.isEmpty {
                    RecommendationSectionShell(
                        title: "Saved Papers",
                        subtitle: "Your bookmarked paper recommendations.",
                        icon: "doc.text.image",
                        count: feedState.savedPapers.count
                    ) {
                        VStack(alignment: .leading, spacing: 16) {
                            ForEach(feedState.savedPapers) { paper in
                                NavigationLink(value: paper) {
                                    PaperCardView(paper: paper)
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }
                }

                if !feedState.savedEvents.isEmpty {
                    RecommendationSectionShell(
                        title: "Saved Events",
                        subtitle: "Conferences, workshops, and seminars you saved.",
                        icon: "calendar.badge.clock",
                        count: feedState.savedEvents.count
                    ) {
                        VStack(alignment: .leading, spacing: 16) {
                            ForEach(feedState.savedEvents) { event in
                                NavigationLink(value: event) {
                                    EventCardView(event: event)
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }
                }

                if !feedState.savedJobs.isEmpty {
                    RecommendationSectionShell(
                        title: "Saved Jobs",
                        subtitle: "Roles you may want to revisit soon.",
                        icon: "briefcase.fill",
                        count: feedState.savedJobs.count
                    ) {
                        VStack(alignment: .leading, spacing: 16) {
                            ForEach(feedState.savedJobs) { job in
                                NavigationLink(value: job) {
                                    JobCardView(job: job)
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }
                }
            }
            .padding(.horizontal, PeerTheme.horizontalPadding)
            .padding(.top, 18)
            .padding(.bottom, 30)
        }
        .navigationTitle("Saved")
        .navigationBarTitleDisplayMode(.inline)
        .peerScreenBackground()
    }
}

struct RecommendationSectionShell<Content: View>: View {
    let title: String
    let subtitle: String
    let icon: String
    let count: Int
    let content: () -> Content

    init(
        title: String,
        subtitle: String,
        icon: String,
        count: Int,
        @ViewBuilder content: @escaping () -> Content
    ) {
        self.title = title
        self.subtitle = subtitle
        self.icon = icon
        self.count = count
        self.content = content
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .top, spacing: 12) {
                Image(systemName: icon)
                    .font(.system(size: 14, weight: .bold))
                    .foregroundColor(PeerTheme.textPrimary)
                    .frame(width: 34, height: 34)
                    .background(Color.black.opacity(0.06))
                    .clipShape(RoundedRectangle(cornerRadius: 10))

                VStack(alignment: .leading, spacing: 4) {
                    Text(title)
                        .font(PeerTheme.titleFont(20, weight: .bold))
                        .foregroundColor(PeerTheme.sectionHeader)
                    Text(subtitle)
                        .font(PeerTheme.bodyFont(PeerTheme.caption))
                        .foregroundColor(PeerTheme.sectionLabel)
                        .fixedSize(horizontal: false, vertical: true)
                }

                Spacer(minLength: 8)

                Text("\(count)")
                    .font(PeerTheme.bodyFont(12, weight: .bold))
                    .foregroundColor(PeerTheme.textPrimary)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(Color.black.opacity(0.05))
                    .clipShape(Capsule())
            }

            Rectangle()
                .fill(PeerTheme.divider)
                .frame(height: 1)

            content()
        }
        .padding(16)
        .background(Color.white)
        .clipShape(RoundedRectangle(cornerRadius: 22))
        .overlay(
            RoundedRectangle(cornerRadius: 22)
                .strokeBorder(PeerTheme.divider, lineWidth: 1)
        )
        .shadow(color: .black.opacity(0.05), radius: 8, x: 0, y: 2)
    }
}

#Preview {
    NavigationStack {
        DiscoveryView()
            .environmentObject(FeedState())
            .environmentObject(ProfileState())
    }
}
