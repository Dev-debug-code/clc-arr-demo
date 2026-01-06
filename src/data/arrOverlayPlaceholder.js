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
      bbox: [58.969106674194336, 81.10894572734833, 492.03263372182846, 214.06082570552826],
      page: 7,
      pageno: 6,
      category: 'PEPs acted for in last 12 months',
      severity: 'warning',
      title: 'High volume of PEP matters',
      details:
        'Practice acted for greater than 10 PEPs in the last 12 months. Consider whether AML procedures are sufficient to cover the increased risk.'
    },
    {
      id: 'Q32 - Clients based overseas',
      bbox: [72.19293732196093, 737.96668612957, 127.05008640885353, 774.7039649784565],
      page: 8,
      pageno: 7,
      category: 'Clients overseas',
      severity: 'note',
      title: 'Clients based overseas in last 12 months',
      details:
        'Practice has acted for overseas clients from the Netherlands and Ireland in the last 12 months.'
    },
    {
      id: 'Q34 - AML Independent Audits',
      bbox: [66.41457915306091, 94.36732649803162, 471.30383402109146, 167.02431106567383],
      page: 8,
      pageno: 7,
      category: 'Independent AML audit',
      severity: 'critical',
      title: 'No independent AML audit completed',
      details:
        'The practice has never undergone an independent audit of AML files, policies, controls and procedures.'
    }
  ]
};

export default arrOverlayPlaceholder;
