//
//  FeedState.swift
//  Hermes
//

import Foundation
import Combine

final class FeedState: ObservableObject {
    @Published var papers: [Paper] = []
    @Published var events: [Event] = []
    @Published var jobs: [Job] = []
    @Published var savedPapers: [Paper] = []
    @Published var savedEvents: [Event] = []
    @Published var savedJobs: [Job] = []
    @Published var isLoading = false
    @Published var lastRefresh: Date?

    private let recommendationService: RecommendationServiceProtocol

    init(recommendationService: RecommendationServiceProtocol = RecommendationService.shared) {
        self.recommendationService = recommendationService
    }

    func loadFeed() {
        isLoading = true
        recommendationService.fetchRecommendations { [weak self] result in
            DispatchQueue.main.async {
                self?.isLoading = false
                self?.lastRefresh = Date()
                switch result {
                case .success(let recs):
                    self?.papers = recs.papers
                    self?.events = recs.events
                    self?.jobs = recs.jobs
                    self?.syncSavedMarkersIntoFeed()
                case .failure:
                    self?.papers = []
                    self?.events = []
                    self?.jobs = []
                }
            }
        }
    }

    func savePaper(_ paper: Paper) {
        var saved = paper
        if let i = papers.firstIndex(where: { $0.id == paper.id }) {
            papers[i].isSaved = true
            papers[i].feedback = .saved
            saved = papers[i]
        } else {
            saved.isSaved = true
            saved.feedback = .saved
        }

        upsertSavedPaper(saved)
        recommendationService.submitFeedback(itemId: paper.id, type: .paper, feedback: .saved)
    }

    func notInterestedPaper(_ paper: Paper) {
        papers.removeAll { $0.id == paper.id }
        savedPapers.removeAll { $0.id == paper.id }
        recommendationService.submitFeedback(itemId: paper.id, type: .paper, feedback: .notInterested)
    }

    func moreLikePaper(_ paper: Paper) {
        if let i = papers.firstIndex(where: { $0.id == paper.id }) {
            papers[i].feedback = .moreLikeThis
        }
        recommendationService.submitFeedback(itemId: paper.id, type: .paper, feedback: .moreLikeThis)
    }

    func saveEvent(_ event: Event) {
        upsertSavedEvent(event)
        recommendationService.submitFeedback(itemId: event.id, type: .event, feedback: .saved)
    }

    func notInterestedEvent(_ event: Event) {
        events.removeAll { $0.id == event.id }
        savedEvents.removeAll { $0.id == event.id }
        recommendationService.submitFeedback(itemId: event.id, type: .event, feedback: .notInterested)
    }

    func saveJob(_ job: Job) {
        upsertSavedJob(job)
        recommendationService.submitFeedback(itemId: job.id, type: .job, feedback: .saved)
    }

    func notInterestedJob(_ job: Job) {
        jobs.removeAll { $0.id == job.id }
        savedJobs.removeAll { $0.id == job.id }
        recommendationService.submitFeedback(itemId: job.id, type: .job, feedback: .notInterested)
    }

    private func upsertSavedPaper(_ paper: Paper) {
        if let index = savedPapers.firstIndex(where: { $0.id == paper.id }) {
            savedPapers[index] = paper
        } else {
            savedPapers.insert(paper, at: 0)
        }
    }

    private func upsertSavedEvent(_ event: Event) {
        if let index = savedEvents.firstIndex(where: { $0.id == event.id }) {
            savedEvents[index] = event
        } else {
            savedEvents.insert(event, at: 0)
        }
    }

    private func upsertSavedJob(_ job: Job) {
        if let index = savedJobs.firstIndex(where: { $0.id == job.id }) {
            savedJobs[index] = job
        } else {
            savedJobs.insert(job, at: 0)
        }
    }

    private func syncSavedMarkersIntoFeed() {
        let savedPaperIds = Set(savedPapers.map(\.id))
        for index in papers.indices {
            if savedPaperIds.contains(papers[index].id) {
                papers[index].isSaved = true
                papers[index].feedback = .saved
            }
        }
    }
}
