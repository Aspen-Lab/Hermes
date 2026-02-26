//
//  FeedCardView.swift
//  Hermes
//

import SwiftUI

/// Shared card container for discovery items (papers, events, jobs).
struct FeedCardView<Content: View>: View {
    let content: Content

    init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }

    var body: some View {
        content
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(12)
            .hermesCardSurface(cornerRadius: 24)
    }
}

/// Action bar: Save / Not Interested / More Like This
struct FeedCardActionsView: View {
    var onSave: (() -> Void)?
    var onNotInterested: (() -> Void)?
    var onMoreLikeThis: (() -> Void)?
    var showMoreLikeThis: Bool = true

    var body: some View {
        HStack(spacing: 12) {
            if let onSave = onSave {
                Button(action: onSave) {
                    Label("Save", systemImage: "bookmark")
                        .font(HermesTheme.bodyFont(14, weight: .semibold))
                }
                .buttonStyle(
                    HermesButtonStyle(
                        foreground: HermesTheme.textPrimary,
                        background: Color.white,
                        border: HermesTheme.divider
                    )
                )
            }

            Spacer(minLength: 0)

            if let onNotInterested = onNotInterested {
                iconActionButton(
                    action: onNotInterested,
                    systemImage: "xmark.circle",
                    foreground: HermesTheme.accentDismiss,
                    background: HermesTheme.accentDismissLight
                )
                .accessibilityLabel("Not Interested")
            }
            if showMoreLikeThis, let onMoreLikeThis = onMoreLikeThis {
                iconActionButton(
                    action: onMoreLikeThis,
                    systemImage: "plus.circle",
                    foreground: HermesTheme.accentMore,
                    background: HermesTheme.accentMoreLight
                )
                .accessibilityLabel("More Like This")
            }
        }
        .padding(.top, 12)
    }

    private func iconActionButton(
        action: @escaping () -> Void,
        systemImage: String,
        foreground: Color,
        background: Color
    ) -> some View {
        Button(action: action) {
            Image(systemName: systemImage)
                .font(.system(size: 17, weight: .semibold))
                .foregroundColor(foreground)
                .frame(width: 38, height: 38)
                .background(background)
                .clipShape(Circle())
                .overlay(
                    Circle()
                        .strokeBorder(foreground.opacity(0.16), lineWidth: 0.9)
                )
        }
        .buttonStyle(.plain)
    }
}

struct CardMetaPill: View {
    let text: String
    let icon: String

    var body: some View {
        HStack(spacing: 5) {
            Image(systemName: icon)
            Text(text)
                .lineLimit(1)
        }
        .font(HermesTheme.bodyFont(12, weight: .semibold))
        .foregroundColor(HermesTheme.primaryLight)
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(Color.black.opacity(0.03))
        .clipShape(Capsule())
    }
}

struct CardRationaleView: View {
    let title: String
    let reason: String

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(HermesTheme.bodyFont(12, weight: .bold))
                .foregroundColor(HermesTheme.sectionLabel)
                .textCase(.uppercase)
            Text(reason)
                .font(HermesTheme.bodyFont(HermesTheme.caption))
                .foregroundColor(HermesTheme.textSecondary)
                .lineLimit(2)
        }
    }
}
