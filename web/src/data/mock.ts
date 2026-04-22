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
  // ── Electrochemistry / battery cathode papers ──
  // Matched to the default profile (LCO cathode, electroplating LCO, cathode
  // materials). Scores are hand-tuned so the feed tells a story in the UI.
  {
    id: "ec1",
    title:
      "Pulsed Electrodeposition of Epitaxial LiCoO₂ Thin Films for Solid-State Microbatteries",
    authors: [
      "Mei-Lin Chang",
      "Daniel R. Kline",
      "Shoji Tanaka",
      "Priya Venkataraman",
    ],
    relevanceReason:
      "Direct match on electroplating LCO — method you flagged as the core of your PhD.",
    venue: "J. Electrochem. Soc.",
    source: "other",
    summaryIntro:
      "Reports a three-step pulsed electrodeposition route that yields (104)-oriented LiCoO₂ films on stainless-steel current collectors at sub-5 mA/cm² current densities. In-situ XRD confirms the layered R-3m phase forms directly without a post-deposition anneal above 500 °C.",
    summaryExperimentKeywords: [
      "electroplating",
      "LiCoO₂",
      "pulsed deposition",
      "thin film",
      "XRD",
      "solid-state battery",
    ],
    summaryResultDiscussion:
      "Films retain 92% of initial capacity after 500 cycles at C/2 between 3.0–4.3 V. Pulsed current density is identified as the dominant parameter for suppressing Co-rich dendritic growth and preserving stoichiometry.",
    linkPaper: "https://doi.org/10.1149/1945-7111/ac8f3d",
    linkArxiv: undefined,
    linkScholar:
      "https://scholar.google.com/scholar?q=pulsed+electrodeposition+LiCoO2+thin+film",
    publishedDate: daysAgo(2),
    isSaved: false,
    feedback: undefined,
    relevanceScore: 0.96,
  },
  {
    id: "ec2",
    title:
      "Surface Engineering of LCO Cathodes via Conformal Al₂O₃ Atomic Layer Deposition for 4.6 V Cycling",
    authors: ["Haruki Mori", "Léa Dupont", "Carlos Moreno-Ayala", "Yuxi Zhao"],
    relevanceReason:
      "LCO cathode stability at high voltage — central topic for your research on cathode materials.",
    venue: "Adv. Energy Mater.",
    source: "other",
    summaryIntro:
      "Demonstrates a 0.8 nm Al₂O₃ coating applied by low-temperature ALD on commercial single-crystal LCO. Correlates coating thickness with H1–3 phase transition suppression using operando synchrotron XRD.",
    summaryExperimentKeywords: [
      "LCO cathode",
      "ALD",
      "Al2O3 coating",
      "high voltage",
      "H1-3 transition",
      "synchrotron XRD",
    ],
    summaryResultDiscussion:
      "Coated cells retain 83% capacity after 200 cycles at 4.6 V vs. Li/Li⁺, compared to 41% for uncoated controls. Coating stabilizes Co³⁺/Co⁴⁺ redox and cuts first-cycle irreversible capacity by 2.1%.",
    linkPaper: "https://doi.org/10.1002/aenm.202300914",
    linkScholar:
      "https://scholar.google.com/scholar?q=LCO+cathode+ALD+Al2O3+4.6V",
    publishedDate: daysAgo(5),
    isSaved: false,
    feedback: undefined,
    relevanceScore: 0.93,
  },
  {
    id: "ec3",
    title:
      "In-situ Raman Spectroscopy of Lithium Cobalt Oxide Phase Transitions During Fast Charging",
    authors: ["Anjali Bhat", "Oleksandr Ivanov", "Sofia Melendez"],
    relevanceReason:
      "Phase-transition characterization on LCO — same material system as your work.",
    venue: "Chem. Mater.",
    source: "other",
    summaryIntro:
      "Uses a custom in-operando Raman cell to track LCO structural evolution under 5C charging. Identifies an intermediate staged phase at x ≈ 0.55 in Li_xCoO₂ that precedes the H1–3 transition and is absent in slower C/5 cycling.",
    summaryExperimentKeywords: [
      "LCO",
      "in-situ Raman",
      "fast charging",
      "phase transition",
      "Li_xCoO2",
      "staging",
    ],
    summaryResultDiscussion:
      "Kinetic asymmetry between charge and discharge scans reveals that the intermediate phase is metastable and collapses into H1–3 within 12 s at open circuit. Provides a direct mechanistic handle for fast-charge degradation.",
    linkPaper: "https://doi.org/10.1021/acs.chemmater.3c00417",
    publishedDate: daysAgo(9),
    isSaved: false,
    feedback: undefined,
    relevanceScore: 0.9,
  },
  {
    id: "ec4",
    title:
      "Gradient Electroplating of Ni-Doped LCO for Enhanced Structural Stability Above 4.5 V",
    authors: [
      "Takashi Yamada",
      "Emeka Okonkwo",
      "Chiara Bianchi",
      "Rishabh Mehta",
    ],
    relevanceReason:
      "Electroplating-based cathode fabrication with Ni doping — useful comparator for your LCO plating route.",
    venue: "Nature Energy",
    source: "other",
    summaryIntro:
      "Reports a gradient electrodeposition method producing Ni-concentrated surface layers on LCO core particles. Variable-anode composition during deposition yields a continuous Ni₀.₀₅→Ni₀.₂₅ gradient across the outer 200 nm.",
    summaryExperimentKeywords: [
      "electroplating",
      "Ni doping",
      "LCO",
      "gradient",
      "cathode stability",
      "4.5 V",
    ],
    summaryResultDiscussion:
      "Gradient material delivers 215 mAh/g at 4.55 V with 88% capacity retention after 300 cycles. Core LCO remains unmodified, preserving bulk capacity while the Ni-rich surface suppresses oxygen release.",
    linkPaper: "https://doi.org/10.1038/s41560-024-01458-1",
    publishedDate: daysAgo(1),
    isSaved: false,
    feedback: undefined,
    relevanceScore: 0.95,
  },
  {
    id: "ec5",
    title:
      "Operando Raman Tracking of LCO Cathode Degradation in Commercial 18650 Cells",
    authors: ["Franz Steinbach", "Amira Hadid", "Lin Wei", "Diego Salamanca"],
    relevanceReason:
      "Commercial-cell validation of LCO degradation mechanisms — useful for translating your lab results.",
    venue: "Electrochim. Acta",
    source: "other",
    summaryIntro:
      "Builds a windowed 18650 cell enabling operando Raman through a sapphire cap. Maps cathode-level degradation across full-cell cycling at rates from C/10 to 3C.",
    summaryExperimentKeywords: [
      "operando Raman",
      "LCO",
      "18650",
      "cathode degradation",
      "full cell",
    ],
    summaryResultDiscussion:
      "Shows a 4× acceleration of I₁ band broadening at 3C vs. C/10, consistent with localized Li depletion near the separator interface. Correlates directly with post-mortem TEM lattice strain maps.",
    linkPaper: "https://doi.org/10.1016/j.electacta.2024.143828",
    publishedDate: daysAgo(14),
    isSaved: false,
    feedback: undefined,
    relevanceScore: 0.88,
  },
  {
    id: "ec6",
    title:
      "Electrochemical Dissolution–Redeposition Pathway for Single-Crystal LCO Synthesis",
    authors: [
      "Yi-Chun Hsu",
      "Marco Caruso",
      "Priya Venkataraman",
      "Elliot N. Rice",
    ],
    relevanceReason:
      "Alternative electroplating-adjacent synthesis for single-crystal LCO — direct overlap with your method space.",
    venue: "J. Power Sources",
    source: "other",
    summaryIntro:
      "Exploits Co²⁺ dissolution from a sacrificial polycrystalline LCO anode into a LiOH melt, followed by galvanostatic redeposition onto a Pt cathode. Yields 3–8 µm single crystals with faceted (104) surfaces.",
    summaryExperimentKeywords: [
      "single-crystal LCO",
      "molten salt",
      "electrochemical synthesis",
      "dissolution redeposition",
      "cathode materials",
    ],
    summaryResultDiscussion:
      "Single-crystal LCO shows 98% first-cycle Coulombic efficiency and 42% lower capacity fade than polycrystalline reference at 4.4 V. Method scales linearly with anode surface area without post-synthesis milling.",
    linkPaper: "https://doi.org/10.1016/j.jpowsour.2024.234119",
    publishedDate: daysAgo(11),
    isSaved: false,
    feedback: undefined,
    relevanceScore: 0.91,
  },

  // ── LLM papers kept as "off-topic" demo: should score low for this profile ──
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
    relevanceScore: 0.42,
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
    relevanceScore: 0.38,
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
    relevanceScore: 0.45,
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
    relevanceScore: 0.35,
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
