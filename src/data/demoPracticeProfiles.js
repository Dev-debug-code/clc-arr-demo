export const DEMO_PRACTICE_PROFILES = [
  {
    id: 'example-conveyancing',
    label: 'Example Conveyancing Co Ltd',
    practiceName: 'Example Conveyancing Co Ltd',
    holp: 'Sarah Chen',
    hofa: 'James Wright',
    previousInspection: '2024-01-17',
    focusAreas: ['aml', 'client-care', 'complaints'],
    preInspectionConcerns:
      'Gifted deposit, estate-derived funds, and inconsistent source-of-funds recording warrant a focused AML review.'
  },
  {
    id: 'harbour-legal',
    label: 'Harbour Legal LLP',
    practiceName: 'Harbour Legal LLP',
    holp: 'Amira Khan',
    hofa: 'David Morse',
    previousInspection: '2023-09-28',
    focusAreas: ['aml', 'accounts', 'management'],
    preInspectionConcerns:
      'Recent staff turnover and prior accountant comments suggest closer checking of AML controls and supervision.'
  },
  {
    id: 'cedar-conveyancing',
    label: 'Cedar Conveyancing Services',
    practiceName: 'Cedar Conveyancing Services',
    holp: 'Nia Roberts',
    hofa: 'Luke Bennett',
    previousInspection: '2024-06-05',
    focusAreas: ['client-care', 'complaints', 'lenders'],
    preInspectionConcerns:
      'Risk profile indicates a recent increase in lender-panel work and a cluster of service complaints.'
  }
];

export const DEMO_PRACTICE_PROFILE_BY_ID = new Map(
  DEMO_PRACTICE_PROFILES.map((profile) => [profile.id, profile])
);
