//
//  RecommendationService.swift
//  Hermes
//

import Foundation

struct RecommendationResult {
    let papers: [Paper]
    let events: [Event]
    let jobs: [Job]
}

enum RecommendationItemType {
    case paper, event, job
}

protocol RecommendationServiceProtocol {
    func fetchRecommendations(completion: @escaping (Result<RecommendationResult, Error>) -> Void)
    func submitFeedback(itemId: String, type: RecommendationItemType, feedback: ItemFeedback)
}

final class RecommendationService: RecommendationServiceProtocol {
    static let shared = RecommendationService()

    private init() {}

    func fetchRecommendations(completion: @escaping (Result<RecommendationResult, Error>) -> Void) {
        // TODO: Replace with real agent/API; use mock for UI development
        DispatchQueue.global(qos: .userInitiated).asyncAfter(deadline: .now() + 0.8) {
            let result = RecommendationResult(
                papers: Self.mockPapers(),
                events: Self.mockEvents(),
                jobs: Self.mockJobs()
            )
            completion(.success(result))
        }
    }

    func submitFeedback(itemId: String, type: RecommendationItemType, feedback: ItemFeedback) {
        // TODO: Send to backend so agents can update interest model
        print("Feedback: \(type) \(itemId) -> \(feedback.rawValue)")
    }

    static func mockPapers() -> [Paper] {
        [
            Paper(
                id: "p1",
                title: "Large Language Models for Sequential Recommendation",
                authors: ["Jane Smith", "John Doe", "Alice Lee"],
                relevanceReason: "Matches your interest in NLP and recommendation systems.",
                venue: "arXiv",
                source: .arxiv,
                summaryIntro: "This work explores using LLMs for next-item recommendation. The authors frame recommendation as a sequence generation task and show strong gains on several benchmarks.",
                summaryExperimentKeywords: ["BERT", "fine-tuning", "sequential", "benchmarks", "ablation"],
                summaryResultDiscussion: "LLM-based recommenders outperform traditional matrix factorization and sequential models. The main gain comes from leveraging pretrained language representations.",
                linkPaper: URL(string: "https://arxiv.org/abs/2301.00000"),
                linkArxiv: URL(string: "https://arxiv.org/abs/2301.00000"),
                linkScholar: URL(string: "https://scholar.google.com"),
                linkCode: URL(string: "https://github.com/example/repo"),
                publishedDate: Date(),
                isSaved: false,
                feedback: nil
            ),
            Paper(
                id: "p2",
                title: "Diffusion Models for 3D Shape Generation",
                authors: ["Bob Chen", "Carol Wang"],
                relevanceReason: "Aligns with your focus on generative models and graphics.",
                venue: "NeurIPS 2024",
                source: .neurIPS,
                summaryIntro: "A diffusion-based approach for generating 3D shapes from noise. The method uses a voxel representation and achieves state-of-the-art FID scores.",
                summaryExperimentKeywords: ["ShapeNet", "voxel", "FID", "sampling steps"],
                summaryResultDiscussion: "The model generates diverse and coherent shapes. Limitations include compute cost and resolution.",
                linkPaper: nil,
                linkArxiv: URL(string: "https://arxiv.org/abs/2302.00000"),
                linkScholar: nil,
                linkCode: URL(string: "https://github.com/example/diffusion-3d"),
                publishedDate: Date().addingTimeInterval(-86400 * 7),
                isSaved: false,
                feedback: nil
            )
        ]
    }

    static func mockEvents() -> [Event] {
        let now = Date()
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        return [
            Event(
                id: "e1",
                name: "NeurIPS 2025",
                type: .conference,
                date: Calendar.current.date(byAdding: .month, value: 10, to: now)!,
                endDate: nil,
                location: "Vancouver, BC",
                isOnline: false,
                deadline: Calendar.current.date(byAdding: .month, value: 6, to: now),
                shortDescription: "Neural Information Processing Systems. Top ML conference.",
                relevanceReason: "You follow NeurIPS and ML systems work.",
                linkRegistration: URL(string: "https://neurips.cc"),
                linkOfficial: URL(string: "https://neurips.cc")
            ),
            Event(
                id: "e2",
                name: "CHI 2025 Workshop: HCI + AI",
                type: .workshop,
                date: Calendar.current.date(byAdding: .month, value: 3, to: now)!,
                endDate: nil,
                location: "Online",
                isOnline: true,
                deadline: Calendar.current.date(byAdding: .day, value: 45, to: now),
                shortDescription: "Workshop on human-AI interaction and evaluation.",
                relevanceReason: "Matches your HCI and AI interests.",
                linkRegistration: URL(string: "https://chi2025.acm.org"),
                linkOfficial: nil
            )
        ]
    }

    static func mockJobs() -> [Job] {
        [
            Job(
                id: "j1",
                roleTitle: "Research Scientist - ML",
                companyOrLab: "DeepMind",
                location: "London / Remote",
                isRemote: true,
                keyRequirements: ["PhD in ML/CS", "Publications at top venues", "PyTorch"],
                matchReason: "Your NLP and RL background fits their research focus.",
                linkPosting: URL(string: "https://careers.google.com"),
                postedDate: Date()
            ),
            Job(
                id: "j2",
                roleTitle: "Applied Scientist",
                companyOrLab: "Amazon Science",
                location: "Seattle, WA",
                isRemote: false,
                keyRequirements: ["PhD or equivalent", "Recommendation systems", "Large-scale ML"],
                matchReason: "Your work on recommendations aligns with this role.",
                linkPosting: URL(string: "https://amazon.jobs"),
                postedDate: Date().addingTimeInterval(-86400 * 3)
            )
        ]
    }
}
