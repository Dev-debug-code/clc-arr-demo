const RESPONSES = [
  {
    triggers: [
      'overseas',
      'uae',
      'dubai',
      'non-uk',
      'non uk',
      'outside the uk',
      'risk level',
      'high risk',
      'edd',
      'enhanced due diligence',
      'classification',
      'risk assessment',
      'what should i be worried'
    ],
    answerText:
      "The firm's own AML policy explicitly addresses this. Section 3.2.1 says: 'Clients resident outside the UK shall be classified as HIGH RISK and subject to Enhanced Due Diligence regardless of nationality. This includes British nationals who are resident overseas.' On this matter the client, Joe Bloggs, has been resident in Dubai for 8 years but the risk assessment classified him as STANDARD with only Standard CDD applied. That is non-compliant with the firm's own policy. [1]",
    citations: [
      {
        n: 1,
        label: '[1]',
        source: '00_Firm_AML_Policy.pdf',
        page: 2,
        quote:
          'Clients resident outside the UK shall be classified as HIGH RISK and subject to Enhanced Due Diligence regardless of nationality. This includes British nationals who are resident overseas.'
      }
    ]
  },
  {
    triggers: ['mlro', 'training', 'interview', 'jane smith'],
    answerText:
      "Jane Smith, the firm's Money Laundering Reporting Officer, describes the firm's source-of-funds verification as informal: 'we're mainly just checking that the numbers broadly stack up... if it looks consistent, we tick the box on the file checklist and move on'. That contradicts the firm's written AML procedure, which requires reasonable enquiries with copies of all relevant documentation retained for 5 years, and the CLC AML guidance position on evidencing source of funds. [1]",
    citations: [
      {
        n: 1,
        label: '[1]',
        source: '11_MLRO_Interview_Transcript.json',
        quote:
          "we're mainly just checking that the numbers broadly stack up ... if it looks consistent, we tick the box on the file checklist and move on"
      }
    ]
  },
  {
    triggers: ['source of funds', 'sof', 'sow', 'savings', 'gift', '200,000', '200000', 'donor', 'estate', 'inheritance', 'distribution'],
    answerText:
      "Source of funds documentation on this matter is incomplete. The client's signed declaration itemises £575,000 personal savings, a £200,000 gift, and a £100,000 estate distribution. The source-of-funds schedule [1] is useful because it separates those streams and records their evidence status, but bank statements only cover about six weeks and the donor source-of-funds review [2] accepts Jill Withers' gift despite no independent evidence of origin or accumulation.",
    citations: [
      {
        n: 1,
        label: '[1]',
        source: '14_Source_of_Funds_Schedule.pdf',
        page: 1,
        quote: 'Longer savings build-up evidence not obtained on file.'
      },
      {
        n: 2,
        label: '[2]',
        source: '08_Giftor_Source_of_Funds.pdf',
        page: 1,
        quote: 'No further donor source-of-funds evidence requested before completion.'
      }
    ]
  },
  {
    triggers: ['bank statement', 'bank statements', 'cross-reference', 'cross reference'],
    answerText:
      "The client bank statements on file cover only 1 September to 15 October 2024, around six weeks. Firm policy section 4.1.1 requires a minimum of 6 months for high-value transactions exceeding £500,000 or overseas clients, and both conditions apply here: this is an £875,000 purchase and the client is resident in the UAE. On their own these statements do not evidence legitimate accumulation of the declared personal savings. [1]",
    citations: [
      {
        n: 1,
        label: '[1]',
        source: '00_Firm_AML_Policy.pdf',
        page: 2,
        quote:
          '4.1.1 For high-value transactions exceeding £500,000 or overseas clients, a minimum of 6 months bank statements must be obtained to evidence legitimate accumulation of funds.'
      }
    ]
  },
  {
    triggers: ['pep', 'politically exposed', 'wrong person', 'misfiled'],
    answerText:
      "The PEP screening report on file [1] screens John Bloggs, not Joe Bloggs. The estate solicitor's letter [2] identifies John Bloggs as Joe Bloggs' deceased father and confirms Joe received £100,000 from his estate. So John Bloggs is relevant to the source-of-funds story, but he is not the buyer/client. The firm should have screened Joe Bloggs for this matter.",
    citations: [
      {
        n: 1,
        label: '[1]',
        source: '10_PEP_Screening.pdf',
        page: 1,
        quote: 'Subject Name: John Bloggs'
      },
      {
        n: 2,
        label: '[2]',
        source: '13_Solicitor_Estate_Distribution_Letter.pdf',
        page: 1,
        quote: 'We confirm that John Bloggs was the deceased father of Joe Bloggs.'
      }
    ]
  },
  {
    triggers: ['who is john bloggs', 'mentioned in any other documents', 'any other documents'],
    answerText:
      "John Bloggs is Joe Bloggs' deceased father. I reached that by cross-checking the PEP report [1] against the estate solicitor's letter [2]: the PEP report names John Bloggs as the screened subject, while the solicitor letter says John Bloggs was Joe's late father and that Joe received a £100,000 estate distribution. That means the firm appears to have run PEP screening on John Bloggs rather than on Joe Bloggs, the buyer/client.",
    citations: [
      {
        n: 1,
        label: '[1]',
        source: '10_PEP_Screening.pdf',
        page: 1,
        quote: 'Subject Name: John Bloggs'
      },
      {
        n: 2,
        label: '[2]',
        source: '13_Solicitor_Estate_Distribution_Letter.pdf',
        page: 1,
        quote:
          'We confirm that Joe Bloggs, a beneficiary of the estate, received a distribution of £100,000 from the estate of his late father, John Bloggs, on 10 October 2024.'
      }
    ]
  },
  {
    triggers: ['good practice', 'exemplary', 'what is the firm doing well'],
    answerText:
      'The source-of-funds schedule, 14_Source_of_Funds_Schedule.pdf, is good file discipline because it itemises each funding stream and clearly records the evidence status for each one. It does not hide the gaps: savings evidence is partial and donor source-of-funds evidence is outstanding, while the estate distribution is supported. [1] [2]',
    citations: [
      {
        n: 1,
        label: '[1]',
        source: '14_Source_of_Funds_Schedule.pdf',
        page: 1,
        quote: 'Estate distribution from John Bloggs deceased'
      },
      {
        n: 2,
        label: '[2]',
        source: '14_Source_of_Funds_Schedule.pdf',
        page: 1,
        quote: 'Source-of-funds evidence outstanding'
      }
    ]
  }
];

export function findCannedReggieResponse(question) {
  const query = String(question || '').trim().toLowerCase();
  if (!query) return null;
  const match = RESPONSES.find((entry) => entry.triggers.some((trigger) => query.includes(trigger)));
  if (!match) return null;
  return {
    answerText: match.answerText,
    citations: match.citations.map((citation, index) => ({
      n: citation.n ?? index + 1,
      label: citation.label ?? `[${index + 1}]`,
      source: citation.source,
      page: Number.isFinite(citation.page) ? citation.page : null,
      quote: citation.quote
    })),
    sourceMode: 'canned'
  };
}
