import { describe, expect, it, vi } from "vitest";
import { defaultProfile } from "@/types";
import {
  createTopicMirroringController,
  type TopicMirroringActions,
} from "./topic-mirroring";

function actionSpies(): TopicMirroringActions {
  return {
    updateTopics: vi.fn(),
    updateSoftTopics: vi.fn(),
    updateEventTopics: vi.fn(),
    updateEventSoftTopics: vi.fn(),
    updateJobTopics: vi.fn(),
    updateJobSoftTopics: vi.fn(),
  };
}

describe("onboarding topic mirroring", () => {
  it("prefills both surfaces from Papers, then preserves a direct Events edit", () => {
    const actions = actionSpies();
    const controller = createTopicMirroringController(defaultProfile, actions);

    controller.updatePaperRequired(["battery"]);
    controller.updateEventRequired(["battery conferences"]);
    controller.updatePaperRequired(["battery", "sodium-ion"]);

    expect(actions.updateTopics).toHaveBeenNthCalledWith(1, ["battery"]);
    expect(actions.updateTopics).toHaveBeenNthCalledWith(2, [
      "battery",
      "sodium-ion",
    ]);
    expect(actions.updateEventTopics).toHaveBeenCalledTimes(2);
    expect(actions.updateEventTopics).toHaveBeenNthCalledWith(1, ["battery"]);
    expect(actions.updateEventTopics).toHaveBeenNthCalledWith(2, [
      "battery conferences",
    ]);
    expect(actions.updateJobTopics).toHaveBeenNthCalledWith(1, ["battery"]);
    expect(actions.updateJobTopics).toHaveBeenNthCalledWith(2, [
      "battery",
      "sodium-ion",
    ]);
  });

  it("treats a direct Explore edit as customization for the whole surface", () => {
    const actions = actionSpies();
    const controller = createTopicMirroringController(defaultProfile, actions);

    controller.updateEventExplore(["conference networking"]);
    controller.updatePaperRequired(["electrochemistry"]);
    controller.updatePaperExplore(["solid electrolyte"]);

    expect(actions.updateEventTopics).not.toHaveBeenCalled();
    expect(actions.updateEventSoftTopics).toHaveBeenCalledOnce();
    expect(actions.updateJobTopics).toHaveBeenCalledWith(["electrochemistry"]);
    expect(actions.updateJobSoftTopics).toHaveBeenCalledWith([
      "solid electrolyte",
    ]);
  });
});
