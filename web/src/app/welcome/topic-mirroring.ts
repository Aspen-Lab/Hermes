import type { UserProfile } from "@/types";

export interface TopicMirroringActions {
  updateTopics: (topics: string[]) => void;
  updateSoftTopics: (topics: string[]) => void;
  updateEventTopics: (topics: string[]) => void;
  updateEventSoftTopics: (topics: string[]) => void;
  updateJobTopics: (topics: string[]) => void;
  updateJobSoftTopics: (topics: string[]) => void;
}

export interface TopicMirroringController {
  updatePaperRequired: (topics: string[]) => void;
  updatePaperExplore: (topics: string[]) => void;
  updateEventRequired: (topics: string[]) => void;
  updateEventExplore: (topics: string[]) => void;
  updateJobRequired: (topics: string[]) => void;
  updateJobExplore: (topics: string[]) => void;
}

function sameTopics(left: string[], right: string[]): boolean {
  return (
    left.length === right.length &&
    left.every((topic, index) => topic === right[index])
  );
}

export function createTopicMirroringController(
  profile: UserProfile,
  actions: TopicMirroringActions,
): TopicMirroringController {
  const paperExplore = profile.softTopics ?? [];
  let eventsCustomized =
    !sameTopics(profile.eventRequiredTopics, profile.researchTopics) ||
    !sameTopics(profile.eventExploreTopics, paperExplore);
  let jobsCustomized =
    !sameTopics(profile.jobRequiredTopics, profile.researchTopics) ||
    !sameTopics(profile.jobExploreTopics, paperExplore);

  return {
    updatePaperRequired: (topics) => {
      actions.updateTopics(topics);
      if (!eventsCustomized) actions.updateEventTopics(topics);
      if (!jobsCustomized) actions.updateJobTopics(topics);
    },
    updatePaperExplore: (topics) => {
      actions.updateSoftTopics(topics);
      if (!eventsCustomized) actions.updateEventSoftTopics(topics);
      if (!jobsCustomized) actions.updateJobSoftTopics(topics);
    },
    updateEventRequired: (topics) => {
      eventsCustomized = true;
      actions.updateEventTopics(topics);
    },
    updateEventExplore: (topics) => {
      eventsCustomized = true;
      actions.updateEventSoftTopics(topics);
    },
    updateJobRequired: (topics) => {
      jobsCustomized = true;
      actions.updateJobTopics(topics);
    },
    updateJobExplore: (topics) => {
      jobsCustomized = true;
      actions.updateJobSoftTopics(topics);
    },
  };
}
