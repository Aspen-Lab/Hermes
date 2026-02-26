//
//  Theme.swift
//  Hermes
//

import SwiftUI
import UIKit

enum HermesTheme {
    // Core palette (Airbnb-inspired neutral + coral direction)
    static let primary = Color(red: 0.13, green: 0.13, blue: 0.15)
    static let primaryLight = Color(red: 0.28, green: 0.30, blue: 0.35)
    static let primaryMuted = Color(red: 0.47, green: 0.49, blue: 0.53)
    static let accentCoral = Color(red: 1.0, green: 0.22, blue: 0.36)
    static let accentCoralSoft = Color(red: 1.0, green: 0.22, blue: 0.36).opacity(0.12)
    static let accentGold = Color(red: 0.84, green: 0.70, blue: 0.43)

    // Background
    static let background = Color(red: 0.97, green: 0.97, blue: 0.97)
    static let backgroundElevated = Color.white
    static let backgroundTint = Color(red: 0.94, green: 0.94, blue: 0.95)

    // Surfaces
    static let cardBackground = Color.white
    static let cardBackgroundStrong = Color.white
    static let cardBorder = Color.black.opacity(0.05)

    // Typography
    static let textPrimary = Color(red: 0.13, green: 0.13, blue: 0.15)
    static let textSecondary = Color(red: 0.40, green: 0.40, blue: 0.43)
    static let textTertiary = Color(red: 0.51, green: 0.51, blue: 0.55)

    // Accents
    static let accentSave = Color(red: 0.10, green: 0.54, blue: 0.36)
    static let accentSaveLight = Color(red: 0.14, green: 0.47, blue: 0.34).opacity(0.12)
    static let accentDismiss = Color(red: 0.45, green: 0.45, blue: 0.48)
    static let accentDismissLight = Color(red: 0.45, green: 0.45, blue: 0.48).opacity(0.12)
    static let accentMore = Color(red: 0.20, green: 0.42, blue: 0.87)
    static let accentMoreLight = Color(red: 0.20, green: 0.42, blue: 0.87).opacity(0.12)

    // Section & UI
    static let sectionHeader = Color(red: 0.15, green: 0.15, blue: 0.17)
    static let sectionLabel = Color(red: 0.46, green: 0.46, blue: 0.50)
    static let divider = Color.black.opacity(0.09)

    // Layout
    static let cardCornerRadius: CGFloat = 22
    static let cardCornerRadiusSmall: CGFloat = 12
    static let cardShadowRadius: CGFloat = 10
    static let cardShadowY: CGFloat = 3
    static let cardShadowOpacity: Double = 0.08
    static let sectionSpacing: CGFloat = 28
    static let horizontalPadding: CGFloat = 20
    static let cardPadding: CGFloat = 20

    // Typography scale
    static let titleLarge: CGFloat = 28
    static let titleMedium: CGFloat = 20
    static let body: CGFloat = 16
    static let callout: CGFloat = 15
    static let caption: CGFloat = 13
    static let captionSmall: CGFloat = 11

    static var screenBackgroundGradient: LinearGradient {
        LinearGradient(
            colors: [background, background, backgroundTint],
            startPoint: .top,
            endPoint: .bottom
        )
    }

    static var cardGradient: LinearGradient {
        LinearGradient(
            colors: [cardBackground, cardBackgroundStrong],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    }

    static func titleFont(_ size: CGFloat, weight: Font.Weight = .bold) -> Font {
        .system(size: size, weight: weight, design: .rounded)
    }

    static func bodyFont(_ size: CGFloat, weight: Font.Weight = .regular) -> Font {
        .system(size: size, weight: weight, design: .default)
    }
}

struct HermesButtonStyle: ButtonStyle {
    var foreground: Color = .white
    var background: Color = HermesTheme.accentCoral
    var border: Color = HermesTheme.accentCoral.opacity(0.2)

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(HermesTheme.bodyFont(HermesTheme.callout, weight: .semibold))
            .foregroundColor(foreground)
            .padding(.horizontal, 16)
            .padding(.vertical, 11)
            .background(background)
            .overlay(
                RoundedRectangle(cornerRadius: HermesTheme.cardCornerRadiusSmall)
                    .strokeBorder(border, lineWidth: 0.5)
            )
            .clipShape(RoundedRectangle(cornerRadius: HermesTheme.cardCornerRadiusSmall))
            .scaleEffect(configuration.isPressed ? 0.98 : 1)
            .animation(.easeInOut(duration: 0.15), value: configuration.isPressed)
    }
}

/// Section header style for Discovery and Profile
struct SectionHeaderView: View {
    let title: String
    var subtitle: String? = nil

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(HermesTheme.titleFont(HermesTheme.titleMedium, weight: .bold))
                .foregroundColor(HermesTheme.sectionHeader)
            if let subtitle = subtitle, !subtitle.isEmpty {
                Text(subtitle)
                    .font(HermesTheme.bodyFont(HermesTheme.caption))
                    .foregroundColor(HermesTheme.sectionLabel)
            }
        }
    }
}

struct HermesBackgroundView: View {
    var body: some View {
        HermesTheme.background.ignoresSafeArea()
    }
}

extension View {
    func hermesScreenBackground() -> some View {
        background {
            HermesBackgroundView()
        }
    }

    func hermesCardSurface(cornerRadius: CGFloat = HermesTheme.cardCornerRadius) -> some View {
        background(HermesTheme.cardGradient)
            .clipShape(RoundedRectangle(cornerRadius: cornerRadius))
            .overlay(
                RoundedRectangle(cornerRadius: cornerRadius)
                    .strokeBorder(HermesTheme.cardBorder, lineWidth: 1)
            )
            .shadow(
                color: .black.opacity(HermesTheme.cardShadowOpacity),
                radius: HermesTheme.cardShadowRadius,
                x: 0,
                y: HermesTheme.cardShadowY
            )
    }
}

struct HermesMosaicView: View {
    let seed: String
    var height: CGFloat = 120
    var imageURLs: [URL] = []

    private var colors: [Color] {
        let palettes: [[Color]] = [
            [Color(red: 0.98, green: 0.74, blue: 0.56), Color(red: 0.93, green: 0.52, blue: 0.42), Color(red: 0.74, green: 0.83, blue: 0.78), Color(red: 0.85, green: 0.79, blue: 0.68)],
            [Color(red: 0.69, green: 0.81, blue: 0.96), Color(red: 0.45, green: 0.62, blue: 0.87), Color(red: 0.86, green: 0.91, blue: 0.98), Color(red: 0.63, green: 0.77, blue: 0.88)],
            [Color(red: 0.97, green: 0.85, blue: 0.66), Color(red: 0.84, green: 0.64, blue: 0.35), Color(red: 0.94, green: 0.75, blue: 0.58), Color(red: 0.70, green: 0.57, blue: 0.39)],
            [Color(red: 0.75, green: 0.86, blue: 0.77), Color(red: 0.45, green: 0.68, blue: 0.56), Color(red: 0.87, green: 0.93, blue: 0.89), Color(red: 0.61, green: 0.78, blue: 0.70)]
        ]
        return palettes[Int(seed.hashValue.magnitude % UInt(palettes.count))]
    }

    private var resolvedURLs: [URL] {
        if imageURLs.count >= 4 {
            return Array(imageURLs.prefix(4))
        }
        return HermesImageLibrary.mixed(seed: seed)
    }

    var body: some View {
        let gap: CGFloat = 6
        let blockCorner: CGFloat = 14

        GeometryReader { geo in
            let safeScreenWidth = UIScreen.main.bounds.width - (HermesTheme.horizontalPadding * 2)
            let totalWidth = max(0, min(geo.size.width, safeScreenWidth))
            let totalHeight = max(0, geo.size.height)
            let leftWidth = max(0, (totalWidth - gap) * 0.58)
            let rightWidth = max(0, totalWidth - leftWidth - gap)
            let rightTopHeight = max(0, (totalHeight - gap) * 0.56)
            let rightBottomHeight = max(0, totalHeight - rightTopHeight - gap)
            let rightBottomTileWidth = max(0, (rightWidth - gap) / 2)

            HStack(spacing: gap) {
                imageTile(url: resolvedURLs[safe: 0], fallback: colors[0], corner: blockCorner)
                    .frame(width: leftWidth, height: totalHeight)

                VStack(spacing: gap) {
                    imageTile(url: resolvedURLs[safe: 1], fallback: colors[1], corner: blockCorner)
                        .frame(width: rightWidth, height: rightTopHeight)
                    HStack(spacing: gap) {
                        imageTile(url: resolvedURLs[safe: 2], fallback: colors[2], corner: blockCorner)
                            .frame(width: rightBottomTileWidth, height: rightBottomHeight)
                        imageTile(url: resolvedURLs[safe: 3], fallback: colors[3], corner: blockCorner)
                            .frame(width: rightBottomTileWidth, height: rightBottomHeight)
                    }
                }
            }
            .frame(width: totalWidth, height: totalHeight, alignment: .leading)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .frame(height: height)
        .clipped()
        .clipShape(RoundedRectangle(cornerRadius: 18))
    }

    private func imageTile(url: URL?, fallback: Color, corner: CGFloat) -> some View {
        ZStack {
            RoundedRectangle(cornerRadius: corner)
                .fill(
                    LinearGradient(
                        colors: [fallback, fallback.opacity(0.7)],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )

            if let url {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case .success(let image):
                        image
                            .resizable()
                            .scaledToFill()
                    case .empty:
                        ProgressView()
                            .tint(.white.opacity(0.9))
                            .frame(maxWidth: .infinity, maxHeight: .infinity)
                    case .failure:
                        Color.clear
                    @unknown default:
                        Color.clear
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .clipped()
        .clipShape(RoundedRectangle(cornerRadius: corner))
    }
}

enum HermesImageLibrary {
    private static let sharedParams = "?auto=format&fit=crop&q=80&w=1400"

    private static let papers = [
        "https://images.unsplash.com/photo-1717501218424-b4724c7882bd\(sharedParams)",
        "https://images.unsplash.com/photo-1717502085413-478382daf23f\(sharedParams)",
        "https://images.unsplash.com/photo-1767216516661-deb40df6f489\(sharedParams)",
        "https://images.unsplash.com/photo-1591453089816-0fbb971b454c\(sharedParams)",
        "https://images.unsplash.com/photo-1761914410572-02614b575847\(sharedParams)",
        "https://images.unsplash.com/photo-1562155695-fb6e1f95fcfd\(sharedParams)"
    ]

    private static let events = [
        "https://images.unsplash.com/photo-1762765685348-4bced247d12c\(sharedParams)",
        "https://images.unsplash.com/photo-1565478441918-ba8d56c559a9\(sharedParams)",
        "https://images.unsplash.com/photo-1727857934778-06d7831a6115\(sharedParams)",
        "https://images.unsplash.com/photo-1668112262164-56e782a6e07a\(sharedParams)",
        "https://images.unsplash.com/photo-1752564291720-1554f0293e59\(sharedParams)",
        "https://images.unsplash.com/photo-1553933899-131780ba04a3\(sharedParams)"
    ]

    private static let jobs = [
        "https://images.unsplash.com/photo-1727857934778-06d7831a6115\(sharedParams)",
        "https://images.unsplash.com/photo-1668112262164-56e782a6e07a\(sharedParams)",
        "https://images.unsplash.com/photo-1752564291720-1554f0293e59\(sharedParams)",
        "https://images.unsplash.com/photo-1761914410572-02614b575847\(sharedParams)",
        "https://images.unsplash.com/photo-1767216516661-deb40df6f489\(sharedParams)",
        "https://images.unsplash.com/photo-1717502085413-478382daf23f\(sharedParams)"
    ]

    private static let profileBank = [
        "https://images.unsplash.com/photo-1668112262164-56e782a6e07a\(sharedParams)",
        "https://images.unsplash.com/photo-1727857934778-06d7831a6115\(sharedParams)",
        "https://images.unsplash.com/photo-1767216516661-deb40df6f489\(sharedParams)",
        "https://images.unsplash.com/photo-1752564291720-1554f0293e59\(sharedParams)",
        "https://images.unsplash.com/photo-1761914410572-02614b575847\(sharedParams)",
        "https://images.unsplash.com/photo-1717501218424-b4724c7882bd\(sharedParams)"
    ]

    private static let mixedBank = papers + events + jobs

    static func paper(seed: String) -> [URL] {
        urls(from: papers, seed: seed)
    }

    static func event(seed: String) -> [URL] {
        urls(from: events, seed: seed)
    }

    static func job(seed: String) -> [URL] {
        urls(from: jobs, seed: seed)
    }

    static func profile(seed: String) -> [URL] {
        urls(from: profileBank, seed: seed)
    }

    static func mixed(seed: String) -> [URL] {
        urls(from: mixedBank, seed: seed)
    }

    private static func urls(from bank: [String], seed: String) -> [URL] {
        guard !bank.isEmpty else { return [] }
        let start = Int(seed.hashValue.magnitude % UInt(bank.count))
        return (0..<4).compactMap { offset in
            URL(string: bank[(start + offset) % bank.count])
        }
    }
}

private extension Array {
    subscript(safe index: Int) -> Element? {
        indices.contains(index) ? self[index] : nil
    }
}

struct HermesStickyCTA<Leading: View>: View {
    let buttonTitle: String
    let action: () -> Void
    let leading: Leading

    init(
        buttonTitle: String,
        action: @escaping () -> Void,
        @ViewBuilder leading: () -> Leading
    ) {
        self.buttonTitle = buttonTitle
        self.action = action
        self.leading = leading()
    }

    var body: some View {
        HStack(spacing: 12) {
            leading
                .frame(maxWidth: .infinity, alignment: .leading)
            Spacer(minLength: 0)
            Button(action: action) {
                Text(buttonTitle)
                    .font(HermesTheme.bodyFont(15, weight: .semibold))
                    .foregroundColor(.white)
                    .lineLimit(1)
                    .minimumScaleFactor(0.85)
                    .padding(.horizontal, 24)
                    .padding(.vertical, 12)
                    .background(HermesTheme.accentCoral)
                    .clipShape(Capsule())
            }
            .fixedSize(horizontal: true, vertical: false)
        }
        .padding(.horizontal, 18)
        .padding(.vertical, 12)
        .background(.ultraThinMaterial)
        .overlay(alignment: .top) {
            Rectangle()
                .fill(HermesTheme.divider)
                .frame(height: 1)
        }
    }
}
