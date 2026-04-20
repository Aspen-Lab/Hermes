import type { Paper, Event, Job } from "@/types";

const today = new Date().toISOString();
const daysAgo = (n: number) =>
  new Date(Date.now() - n * 86400_000).toISOString();
const monthsFromNow = (n: number) => {
  const d = new Date();
  d.setMonth(d.getMonth() + n);
  return d.toISOString();
};
const daysFromNow = (n: number) =>
  new Date(Date.now() + n * 86400_000).toISOString();

export const mockPapers: Paper[] = [
  {
    id: "p1",
    title: "Attention Is All You Need",
    authors: ["Ashish Vaswani", "Noam Shazeer", "Niki Parmar", "Jakob Uszkoreit", "Llion Jones", "Aidan N. Gomez", "Łukasz Kaiser", "Illia Polosukhin"],
    relevanceReason:
      "Foundational transformer architecture paper — directly relevant to your LLM research.",
    venue: "NeurIPS 2017",
    source: "arxiv",
    summaryIntro:
      "Proposes the Transformer, a novel architecture based entirely on attention mechanisms, dispensing with recurrence and convolutions. Achieves state-of-the-art on machine translation.",
    summaryExperimentKeywords: [
      "self-attention",
      "multi-head",
      "encoder-decoder",
      "WMT",
      "BLEU",
    ],
    summaryResultDiscussion:
      "The Transformer achieves 28.4 BLEU on WMT 2014 English-to-German, outperforming all previous models including ensembles. Training is significantly more parallelizable.",
    linkPaper: "https://arxiv.org/abs/1706.03762",
    linkArxiv: "https://arxiv.org/abs/1706.03762",
    linkScholar: "https://scholar.google.com/scholar?q=attention+is+all+you+need",
    linkCode: "https://github.com/tensorflow/tensor2tensor",
    publishedDate: daysAgo(1),
    isSaved: false,
    feedback: undefined,
    relevanceScore: 0.94,
  },
  {
    id: "p2",
    title: "Denoising Diffusion Probabilistic Models",
    authors: ["Jonathan Ho", "Ajay Jain", "Pieter Abbeel"],
    relevanceReason:
      "Key diffusion model paper — connects to your interest in generative models.",
    venue: "NeurIPS 2020",
    source: "arxiv",
    summaryIntro:
      "Presents high quality image synthesis using diffusion probabilistic models. Shows that a certain parameterization of diffusion models reveals a connection to denoising score matching and Langevin dynamics.",
    summaryExperimentKeywords: [
      "diffusion",
      "denoising",
      "FID",
      "image generation",
    ],
    summaryResultDiscussion:
      "Achieves state-of-the-art FID scores on CIFAR-10 and competitive log-likelihoods, establishing diffusion models as a viable alternative to GANs.",
    linkArxiv: "https://arxiv.org/abs/2006.11239",
    linkCode: "https://github.com/hojonathanho/diffusion",
    publishedDate: daysAgo(7),
    isSaved: false,
    feedback: undefined,
    relevanceScore: 0.87,
  },
  {
    id: "p3",
    title: "Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks",
    authors: ["Patrick Lewis", "Ethan Perez", "Aleksandra Piktus", "Fabio Petroni", "Vladimir Karpukhin", "Naman Goyal", "Heinrich Küttler", "Mike Lewis", "Wen-tau Yih", "Tim Rocktäschel", "Sebastian Riedel", "Douwe Kiela"],
    relevanceReason:
      "Foundational RAG paper — directly relevant to your work on retrieval-augmented systems.",
    venue: "NeurIPS 2020",
    source: "arxiv",
    summaryIntro:
      "Introduces RAG, combining parametric and non-parametric memory for language generation. Uses a pre-trained retriever (DPR) with a pre-trained seq2seq model (BART).",
    summaryExperimentKeywords: [
      "RAG",
      "retrieval",
      "knowledge-intensive",
      "open-domain QA",
      "DPR",
    ],
    summaryResultDiscussion:
      "RAG models set state-of-the-art on three open-domain QA benchmarks, outperforming parametric-only and retrieval-only baselines. More factual and specific than pure generation.",
    linkArxiv: "https://arxiv.org/abs/2005.11401",
    linkPaper: "https://arxiv.org/abs/2005.11401",
    publishedDate: daysAgo(2),
    isSaved: false,
    feedback: undefined,
    relevanceScore: 0.91,
  },
  {
    id: "p4",
    title: "Switch Transformers: Scaling to Trillion Parameter Models with Simple and Efficient Sparsity",
    authors: ["William Fedus", "Barret Zoph", "Noam Shazeer"],
    relevanceReason:
      "Scaling sparse MoE models — connects to your interest in efficient architectures.",
    venue: "JMLR 2022",
    source: "arxiv",
    summaryIntro:
      "Simplifies the Mixture of Experts routing algorithm to produce Switch Transformers, which are more efficient and stable to train. Demonstrates scaling up to trillion parameter models.",
    summaryExperimentKeywords: [
      "MoE",
      "sparse",
      "scaling",
      "routing",
      "efficiency",
    ],
    summaryResultDiscussion:
      "Switch Transformers achieve 4-7x speedup over T5-Base and T5-Large while matching quality. Shows that sparse models can be pre-trained effectively across many different scales.",
    linkArxiv: "https://arxiv.org/abs/2101.03961",
    publishedDate: daysAgo(4),
    isSaved: false,
    feedback: undefined,
    relevanceScore: 0.82,
  },
];

export const mockEvents: Event[] = [
  {
    id: "e1",
    name: "NeurIPS 2025",
    type: "conference",
    date: monthsFromNow(10),
    location: "Vancouver, BC",
    isOnline: false,
    deadline: monthsFromNow(6),
    shortDescription:
      "Neural Information Processing Systems. Top ML conference.",
    relevanceReason: "You follow NeurIPS and ML systems work.",
    linkRegistration: "https://neurips.cc",
    linkOfficial: "https://neurips.cc",
    relevanceScore: 0.96,
  },
  {
    id: "e2",
    name: "CHI 2025 Workshop: HCI + AI",
    type: "workshop",
    date: monthsFromNow(3),
    location: "Online",
    isOnline: true,
    deadline: daysFromNow(45),
    shortDescription:
      "Workshop on human-AI interaction and evaluation.",
    relevanceReason: "Matches your HCI and AI interests.",
    linkRegistration: "https://chi2025.acm.org",
    relevanceScore: 0.85,
  },
  {
    id: "e3",
    name: "ICLR 2025",
    type: "conference",
    date: monthsFromNow(1),
    location: "Singapore",
    isOnline: false,
    deadline: daysAgo(60),
    shortDescription:
      "International Conference on Learning Representations. Focus on deep learning foundations.",
    relevanceReason:
      "Core venue for your representation learning research.",
    linkRegistration: "https://iclr.cc",
    linkOfficial: "https://iclr.cc",
    relevanceScore: 0.92,
  },
];

export const mockJobs: Job[] = [
  {
    id: "j1",
    roleTitle: "Research Scientist — ML",
    companyOrLab: "DeepMind",
    location: "London / Remote",
    isRemote: true,
    keyRequirements: [
      "PhD in ML/CS",
      "Publications at top venues",
      "PyTorch",
    ],
    matchReason:
      "Your NLP and RL background fits their research focus.",
    linkPosting: "https://deepmind.google/about/careers/",
    postedDate: today,
    relevanceScore: 0.93,
  },
  {
    id: "j2",
    roleTitle: "Applied Scientist",
    companyOrLab: "Amazon Science",
    location: "Seattle, WA",
    isRemote: false,
    keyRequirements: [
      "PhD or equivalent",
      "Recommendation systems",
      "Large-scale ML",
    ],
    matchReason:
      "Your work on recommendations aligns with this role.",
    linkPosting: "https://www.amazon.science/careers",
    postedDate: daysAgo(3),
    relevanceScore: 0.88,
  },
  {
    id: "j3",
    roleTitle: "AI Research Engineer",
    companyOrLab: "Anthropic",
    location: "San Francisco, CA",
    isRemote: true,
    keyRequirements: [
      "Strong ML fundamentals",
      "Experience with LLMs",
      "Python/C++",
      "Safety research interest",
    ],
    matchReason:
      "Aligns with your interest in AI safety and LLM research.",
    linkPosting: "https://www.anthropic.com/careers",
    postedDate: daysAgo(1),
    relevanceScore: 0.9,
  },
];
