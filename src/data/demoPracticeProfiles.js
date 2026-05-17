import demoPracticeProfilesJson from './demoPracticeProfiles.json';

export const DEMO_PRACTICE_PROFILES = demoPracticeProfilesJson;

export const DEMO_PRACTICE_PROFILE_BY_ID = new Map(
  DEMO_PRACTICE_PROFILES.map((profile) => [profile.id, profile])
);
