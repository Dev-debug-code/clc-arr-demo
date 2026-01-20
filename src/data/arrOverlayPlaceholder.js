const arrOverlayPlaceholder = {
  source: {
    expectedFilename: 'Handwritten_ARR_updated.pdf',
    displayName: 'Annual Regulatory Return 2022',
    summary: 'Highlights derived from the ARR PDF with bounding boxes synced to each issue.'
  },
  insights: [
    'Practice has elevated AML exposure due to a high volume of PEP clients and the absence of any independent AML audit.',
    'Limited overseas client activity (Netherlands and Ireland) introduces minor additional risk but still needs monitoring.'
  ],
  boxes: [
    {
      id: 'Q30 - PEPs acted for',
      bbox: [58, 90, 500, 230],
      page: 7,
      pageno: 6,
      category: 'PEPs acted for in last 12 months',
      severity: 'warning',
      title: 'High volume of PEP matters',
      details:
        'Practice acted for greater than 10 PEPs in the last 12 months, consider if AML procedures are sufficient to cover the increased risk.'
    },
    {
      id: 'Q32 - Clients based overseas',
      bbox: [58, 275, 500, 735],
      page: 8,
      pageno: 7,
      category: 'Acted for clients overseas in last 12 months',
      severity: 'note',
      title: 'Clients based overseas in last 12 months',
      details:
        'Practice has acted for overseas clients from the Netherlands and Ireland in the last 12 months.'
    },
    {
      id: 'Q34 - AML Independent Audits',
      bbox: [58, 100, 500, 180],
      page: 8,
      pageno: 7,
      category: 'Date of last independent audit of AML procedures',
      severity: 'critical',
      title: 'No independent AML audit completed',
      details:
        'The practice has never undergone an independent audit of AML files, policies, controls and procedures.'
    }
  ]
};

export default arrOverlayPlaceholder;
