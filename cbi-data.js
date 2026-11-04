// CBI ICT Self-Assessment Tool — Section 4 (ICT Risk Control) questionnaire.
// Static reference data transcribed from the CBI template. Each question carries
// the DORA article(s) it cites; each category carries capHints (the app capability
// ids it covers). Evidence is matched on BOTH: exact "Article N" objectives AND the
// category capabilities (robust to RTS-labelled objectives). capHints are editable.
window.CBI_SECTION4 = {
 "source": "Central Bank of Ireland — ICT Self-Assessment Tool, Section 4 (ICT Risk Control)",
 "maturity": [
  {
   "level": 1,
   "label": "Best controls in place",
   "criteria": "Controls mature and well established: formally documented with defined requirements, tested regularly, reviewed in scheduled risk assessments, operating effectively (verified by independent testing), and optimised/automated. No investment planned beyond maintenance."
  },
  {
   "level": 2,
   "label": "Generally effective",
   "criteria": "Controls generally operating effectively and consistently; risks generally mitigated. Documented, tested regularly, reviewed, operating effectively (independent testing). Improvements identified through testing/review."
  },
  {
   "level": 3,
   "label": "Partial / inconsistent",
   "criteria": "Some controls in place but not consistent and/or not operating effectively across the whole organisation. Documented, tested, reviewed — but a need for improvement/investment exists and risks are not fully mitigated yet."
  },
  {
   "level": 4,
   "label": "Not in place",
   "criteria": "Controls not in place and/or risks not effectively mitigated. Mitigation activities may be identified but not started."
  }
 ],
 "categories": [
  {
   "id": "4.1",
   "name": "ICT Governance and ICT Risk Management",
   "capHints": [
    "governance_mgmt",
    "risk_mgmt"
   ],
   "questions": [
    {
     "ref": "1.1",
     "text": "An ICT strategy is defined, documented, approved by the management body and aligned with the business and risk strategies (e.g. risk appetite). Senior management are involved in the definition of the RE’s strategic ICT priorities. It contains an acceptable level of detail with measurable goals for the most important ICT areas, supported by concrete implementation plans and takes into account risk associated with the strategy. ICT-enabled investment programmes and projects required to achieve specific strategic business objectives are actively monitored by relevant stakeholders.",
     "articles": [],
     "articleNums": []
    },
    {
     "ref": "1.2",
     "text": "The RE has a Digital Operational Resilience strategy which includes methods to manage ICT risk and attain specific ICT objectives, in accordance with Article 6(8) in conjunction with Article 5(2) (d). The RE also monitors the effectiveness of the implementation of their digital operational resilience strategy and has a process in place to understand the level of ICT risk exposure, in particular in relation to critical or important functions. ICT Governance and Risk Management 2. ICT organisation Maturity Levels level selected and reference supporting documentation. \" relative to the control question and maturity level selected. Please also include a description of the measures taken to address the identified weaknesses.\".",
     "articles": [
      "6(8)",
      "5(2) (d)"
     ],
     "articleNums": [
      5,
      6
     ]
    },
    {
     "ref": "2.1",
     "text": "The RE has established an internal governance framework for ICT risk management and accountability, in accordance with Article 5(1) & 5(2).",
     "articles": [
      "5(1)"
     ],
     "articleNums": [
      5
     ]
    },
    {
     "ref": "2.2",
     "text": "The management body of the RE holds ultimate accountability for the ICT risk management framework and digital operational resilience strategy. In accordance with Article 5(2) DORA it defines, approves, and oversees all ICT arrangements, sets ICT risk tolerance levels, establishes clear roles and responsibilities and ensures effective governance and oversight of all ICT- related incidents.",
     "articles": [
      "5(2)"
     ],
     "articleNums": [
      5
     ]
    },
    {
     "ref": "2.3",
     "text": "Members of the management body keep their ICT risk knowledge current and relevant through regular training in accordance with Article 5(4).",
     "articles": [
      "5(4)"
     ],
     "articleNums": [
      5
     ]
    },
    {
     "ref": "2.4",
     "text": "The RE includes in its human resource policy or other relevant policies all appropriate ICT security related elements in accordance with Article 19 RTS RMF.",
     "articles": [
      "19"
     ],
     "articleNums": [
      19
     ]
    },
    {
     "ref": "2.5",
     "text": "The RE has identified, classified, and documented all ICT supported business functions, roles and responsibilities, and the information and ICT assets supporting those functions, including their interdependencies, it also reviews, as needed and at least yearly, the adequacy and completeness of these classifications and documentation in accordance with Article 8(1).",
     "articles": [
      "8(1)"
     ],
     "articleNums": [
      8
     ]
    },
    {
     "ref": "2.6",
     "text": "The RE has identified and mapped all information and ICT assets - including critical assets, configurations, and interdependencies - at remote sites, network resources, and hardware, and maintains inventories which are updated periodically and upon major changes, in accordance with Article 8(4) & (6).",
     "articles": [
      "8(4)"
     ],
     "articleNums": [
      8
     ]
    },
    {
     "ref": "2.7",
     "text": "In accordance with Article 8(5) DORA, the RE maintains and periodically updates a comprehensive inventory of all processes dependent on ICT third- party service providers including all identified interconnections with providers that support critical or important functions. The inventory is updated whenever any significant change occurs in the network or information system infrastructure, or in processes or procedures affecting ICT-supported business functions, information assets, or ICT assets.",
     "articles": [
      "8(5)"
     ],
     "articleNums": [
      8
     ]
    },
    {
     "ref": "2.8",
     "text": "RE conducts ICT risk assessments on a regular basis and at minimum annually for all legacy ICT systems. Additionally, ICT risk assessments are performed before connecting new technologies, ICT Governance and Risk Management 3 ICT Risk Management Framework Maturity Levels level selected and reference supporting documentation. \" weaknesses relative to the control question and maturity level selected. Please also include a description of the measures taken to address the identified weaknesses.\".",
     "articles": [],
     "articleNums": []
    },
    {
     "ref": "3.1",
     "text": "The RE has in place a documented ICT risk management framework, as part of its overall risk management system to identify, assess, and mitigate ICT risk, in accordance with Article 6 DORA & Article 3 RTS RMF. In particular the ICT risk management framework is supported by strategies, policies, procedures, ICT protocols and tools that address the following: (a) the risk tolerance for ICT risk and its approval. (b) a methodology to regularly conduct ICT risk assessments, including identifying vulnerabilities and threats that may affect the supported business functions, ICT systems and ICT assets supporting these functions and the quantitative or qualitative indicators to measure the impact and likelihood of vulnerabilities and threats. (c) a procedure to identify and document ICT risk treatment measures for ICT risks identified, to bring ICT risk within the approved risk tolerance. (d) a procedure to identify, manage and monitor any residual ICT risks still present that exceed the approved risk tolerance, including a justification for their acceptance and regular review. (e) an inventory of identified ICT risks, treatment measures and residual ICT risk. (f) provisions for the monitoring of any changes to the ICT risk and cyber threat landscape that could affect its ICT risk profile. (g) provisions for the monitoring of the effectiveness of the ICT risk treatment measures implemented and an assessment of whether the approved risk tolerance levels have been attained.",
     "articles": [
      "6",
      "3"
     ],
     "articleNums": [
      3,
      6
     ]
    },
    {
     "ref": "3.2",
     "text": "The ICT risk management framework is reviewed at least once a year and as well as upon the occurrence of major ICT-related incidents in accordance with Article 6(5). A report on the review of the ICT risk management framework is also conducted yearly in accordance with Article 27 RTS RMF.",
     "articles": [
      "6(5)",
      "27"
     ],
     "articleNums": [
      6,
      27
     ]
    },
    {
     "ref": "3.3",
     "text": "The RE, in the context of the digital operational resilience strategy referred to in Article 6(8) DORA, has defined an ICT multi-vendor strategy, showing key dependencies on ICT third-party service providers and explaining the rationale behind the procurement mix of ICT third- party service providers in accordance with Article 6(9).",
     "articles": [
      "6(8)",
      "6(9)"
     ],
     "articleNums": [
      6
     ]
    },
    {
     "ref": "3.4",
     "text": "The RE has assigned responsibility for managing and overseeing ICT risk to a control function and ensures an appropriate level of independence in order to avoid conflicts of interest in accordance with Article 6(4). REs shall ensure appropriate segregation and independence of ICT risk management functions, control functions, and internal audit functions, according to the three lines of defence model, or an internal risk management and control model, in accordance with Article 6(4).",
     "articles": [
      "6(4)",
      "6(4)"
     ],
     "articleNums": [
      6
     ]
    },
    {
     "ref": "3.5",
     "text": "The RE, on a continuous basis, identifies all sources of ICT risk, in particular the risk exposure to and from other financial entities, and assess cyber threats and ICT vulnerabilities relevant to their ICT supported business functions, information assets and ICT assets. The RE reviews on a regular basis, and at least yearly, the risk scenarios impacting it, in accordance with Article 8(2). ICT Governance and Risk Management 4 ICT Internal Audit (3LoD) Maturity Levels maturity level selected and reference supporting documentation. \" weaknesses relative to the control question and maturity level selected. Please also include a description of the measures taken to address the identified weaknesses.\".",
     "articles": [
      "8(2)"
     ],
     "articleNums": [
      8
     ]
    },
    {
     "ref": "4.1",
     "text": "The ICT risk management framework is subject to internal audit on a regular basis by suitably qualified internal auditors, in accordance with Article 6 (6) DORA, with an audit plan that covers critical ICT risks (including those of outsourced activities). The audit plan reflects prior audit findings and calibrates audit frequency and scope to the entity's ICT risk profile.",
     "articles": [
      "6 (6)"
     ],
     "articleNums": [
      6
     ]
    }
   ]
  },
  {
   "id": "4.2",
   "name": "ICT Third Party Management",
   "capHints": [
    "third_party_risk"
   ],
   "questions": [
    {
     "ref": "6.1",
     "text": "The RE has established an ICT third party risk management strategy in accordance with Article 28(2) DORA which is formally approved by the management body and integrated into the ICT risk management framework. The strategy includes a third-party risk management policy covering ICT services supporting critical or important functions and encompasses all the requirements set out in the Regulatory Technical Standard (RTS) ICT Third Party Policy (TPPol).",
     "articles": [
      "28(2)"
     ],
     "articleNums": [
      28
     ]
    },
    {
     "ref": "6.2",
     "text": "The RE has established and maintains a Register of Information (RoI) for all ICT third-party contractual arrangements in accordance with Article 28(3) DORA and uses the standard templates and data fields set out in ITS RoI. All contractual arrangements are appropriately documented, with clear distinctions between those supporting critical or important functions and those that do not. ICT Third Party Risk Management 7 Governance of ICT Third Party arrangements Maturity Levels maturity level selected and reference supporting documentation. \" weaknesses relative to the control question and maturity level selected. Please also include a description of the measures taken to address the identified weaknesses.\".",
     "articles": [
      "28(3)"
     ],
     "articleNums": [
      28
     ]
    },
    {
     "ref": "7.1",
     "text": "In accordance with Article 28 DORA, the management body of the RE ensures that the ICT third party risk management strategy and policy are regularly reviewed, with all resulting changes approved, documented and implemented.",
     "articles": [
      "28"
     ],
     "articleNums": [
      28
     ]
    },
    {
     "ref": "7.2",
     "text": "The RE’s ICT third-party risk management policy is aligned with the requirements set-out RTS TPPol and provides for independent review and audits verifying compliance with legal and regulatory requirements.",
     "articles": [],
     "articleNums": []
    },
    {
     "ref": "7.3",
     "text": "The RE’s ICT third-party risk management policy in accordance with Article 8 RTS TPPol specifies that the contractual arrangements: (a) do not relieve the RE and its management body of its regulatory obligations and its responsibilities to its clients; (b) are not to prevent effective supervision of a RE and are not to contravene any supervisory restrictions on services and activities; (c) are to require that the ICT third party service providers cooperate with the competent authorities; (d) are to require that the RE, its auditors, and competent authorities have effective access to data and premises relating to the use of ICT services supporting critical or important functions.",
     "articles": [
      "8"
     ],
     "articleNums": [
      8
     ]
    },
    {
     "ref": "7.4",
     "text": "For ICT assets or services operated by an ICT third-party service provider, the RE has identified and implemented the necessary requirements to maintain digital operational resilience, in accordance with the results of the data classification and ICT risk assessment, as specified in the Article 11(2)(k) RTS RMF. ICT Third Party Risk Management 8 Main phases of the life cycle for the adoption and use of contractual arrangements Maturity Levels level selected and reference supporting documentation. known weaknesses relative to the control question and maturity level selected. Please also include a description of the measures taken to address the identified weaknesses.\".",
     "articles": [
      "11(2)(k)"
     ],
     "articleNums": [
      11
     ]
    },
    {
     "ref": "8.1",
     "text": "The RE’s ICT third-party risk management policy specifies the requirements, including the rules, the responsibilities and the processes, for each main phase of the lifecycle of the contractual arrangement, covering at least the following: (a) the responsibilities of the management body, including its involvement, as appropriate, in the decision-making process on the use of ICT services supporting critical or important functions provided by ICT third-party service providers; (b) the planning of contractual arrangements, including the risk assessment, the due diligence as set out in Articles 5 and 6 of the RTS TPPol and the approval process regarding new or material changes to contractual arrangements as set out in Article 8(4) of the RTS TPPol; (c) For ICT services supporting critical or important functions, the due diligence verifies the existence of risk mitigation and business continuity measures and how their functioning within the ICT third-party service provider is ensured.",
     "articles": [
      "8(4)"
     ],
     "articleNums": [
      8
     ]
    },
    {
     "ref": "8.2",
     "text": "The RE’s ICT third-party risk management policy specifies the requirements, including the rules, the responsibilities and the processes, for each main phase of the lifecycle of the contractual arrangement, covering at least the following: (a) the involvement of business units, internal controls and other relevant units in respect of contractual arrangements; (b) the implementation, monitoring and management of contractual arrangements as referred to in Articles 7, 8 and 9 RTS TPPol, including at consolidated and sub-consolidated level, where applicable; (c) the documentation and record- keeping, taking into account the requirements with regard to the register of information laid down in Article 28(3) DORA; (d) the exit strategies and termination processes as set out in Article 10 RTS TPPol.",
     "articles": [
      "28(3)",
      "10"
     ],
     "articleNums": [
      10,
      28
     ]
    },
    {
     "ref": "8.3",
     "text": "In accordance with Article 6 RTS TPPol, the RE’s ICT third-party risk management policy details which elements are to be used to assess the required level of assurance on the ICT third-party service provider’s performance among: (a) audits or independent assessments performed by the RE itself or on its behalf; (b) the use of independent audit reports made on request by the ICT third-party service provider; (c) the use of audit reports made by the internal audit function of the ICT third- party service provider; (d) the use of appropriate third-party certifications; (e) the use of other relevant information available to the RE or other information provided by the ICT third-party service provider.",
     "articles": [
      "6"
     ],
     "articleNums": [
      6
     ]
    },
    {
     "ref": "8.4",
     "text": "Contracts with ICT third-party providers that support critical or important ICT functions (or significant components thereof - that are eligible for subcontracting), specify: (a) the subcontractor’s reporting obligations; (b) the ICT Third Party Provider must maintain continuity of ICT services across all subcontractors; (c) the RE will be notified of any material changes to subcontracting with adequate notice; (d) the RE retains termination rights. ICT Third Party Risk Management 9 Conflicts of Interest Maturity Levels level selected and reference supporting documentation. known weaknesses relative to the control question and maturity level selected. Please also include a description of the measures taken to address the identified weaknesses.\".",
     "articles": [],
     "articleNums": []
    },
    {
     "ref": "9.1",
     "text": "In accordance with Article 6-8 of the RTS TPPol, the RE's ensures its ICT third-party risk management policy defines measures to identify, prevent, and manage actual or potential conflicts of interest with ICT third- party and intra-group service providers, provides for ongoing monitoring, and ensures that decisions on conditions, including financial conditions, for ICT services supporting critical or important functions are taken objectively.",
     "articles": [
      "6"
     ],
     "articleNums": [
      6
     ]
    },
    {
     "ref": "9.2",
     "text": "Where ICT services are provided by ICT intra-group service providers, the RE's ICT third-party risk management policy specifies, that decisions on conditions, including the financial conditions, for the ICT services supporting critical or important functions are taken objectively in accordance with Article 7 RTS TPPol. ICT Third Party Risk Management 10 Contractual clauses for the use of ICT services supporting critical or important functions Maturity Levels level selected and reference supporting documentation. \" known weaknesses relative to the control question and maturity level selected. Please also include a description of the measures taken to address the identified weaknesses.\".",
     "articles": [
      "7"
     ],
     "articleNums": [
      7
     ]
    },
    {
     "ref": "10.1",
     "text": "The ICT third-party usage policy specifies that the relevant contractual arrangement shall be written and shall include all the elements set out by Article 30(2) and 30(3) of Regulation (EU) 2022/2554. The policy also includes elements regarding requirements applicable to financial entities as per Article 1(1)(a) of Regulation (EU) 2022/2554, as well as other relevant Union and national law as appropriate.",
     "articles": [
      "30(2)",
      "1(1)(a)"
     ],
     "articleNums": [
      1,
      30
     ]
    },
    {
     "ref": "10.2",
     "text": "The RE ensures that ICT third-party contracts comply with Articles 28– 30 DORA, clearly defining service scope, information assets, security and resilience requirements, subcontracting, termination, and robust access, inspection, audit, and ICT testing rights; oversight is exercised through internal audits, independent third parties, pooled audits, ICT testing (including threat led penetration testing (TLPT) where applicable), and reliance on certification reports where appropriate, while the RE retains full responsibility and accountability for compliance and operational resilience.",
     "articles": [],
     "articleNums": []
    },
    {
     "ref": "10.3",
     "text": "The RE’s ICT third-party risk management policy ensures that it does not rely solely, over time, on third party certifications or audit reports for ICT third party service providers in accordance with Article 3 RTS TPPol.",
     "articles": [
      "3"
     ],
     "articleNums": [
      3
     ]
    },
    {
     "ref": "10.4",
     "text": "The RE’s ICT third-party risk management policy ensures that material changes to the relevant contractual agreement shall be formalised in a written document, dated, and signed by all parties and shall specify the renewal process for contractual arrangements in accordance with Article 4 RTS TPPol. ICT Third Party Risk Management 11 Monitoring of the contractual arrangements for the use of ICT services supporting critical or important functions and exit/termination Maturity Levels maturity level selected and reference supporting documentation. \" known weaknesses relative to the control question and maturity level selected. Please also include a description of the measures taken to address the identified weaknesses.\".",
     "articles": [
      "4"
     ],
     "articleNums": [
      4
     ]
    },
    {
     "ref": "11.1",
     "text": "The RE's ICT third-party risk management policy, in accordance with Article 28(1), (2), & (5) DORA, ensures the continuous monitoring, assessment, and documentation of ICT third-party service providers supporting critical or important functions. This is achieved through various tools including reports, KPIs, and audits, with assessment results being used to update the entity's ICT and overall risk assessments.",
     "articles": [
      "28(1)"
     ],
     "articleNums": [
      28
     ]
    },
    {
     "ref": "11.2",
     "text": "The RE ensures that its ICT third- party risk management policy, in accordance with Article 28(7) & (8) DORA defines appropriate remediation measures and contractual consequences for ICT third party service provider deficiencies or non-compliance.",
     "articles": [
      "28(7)"
     ],
     "articleNums": [
      28
     ]
    },
    {
     "ref": "11.3",
     "text": "The RE has documented a realistic and periodically tested exit plan for ICT services supporting critical or important functions in accordance with Article 28 (8) DORA, taking into account severe disruption scenarios, failed service delivery, or termination of contractual arrangements.",
     "articles": [
      "28 (8)"
     ],
     "articleNums": [
      28
     ]
    }
   ]
  },
  {
   "id": "4.3",
   "name": "Information Security Management",
   "capHints": [
    "access_control",
    "vulnerability_mgmt",
    "asset_mgmt",
    "data_mgmt",
    "incident_mgmt",
    "major_incident_mgmt"
   ],
   "questions": [
    {
     "ref": "12.1",
     "text": "The RE has established an information security policy in accordance with Article 9(4) (a) DORA which is approved by the management body and aligned to the information security objectives included in the Digital Operational Resilience strategy. The Information Security policy includes the following: (a) rules to protect the RE’s information assets inline with strategy and risk appetite; (b) is applicable to all employees and third parties accessing information; (c) refers to i) ensuring the security of networks; ii) safeguards against intrusions and data misuse; iii) preserving the availability, authenticity, integrity, and confidentiality of data; (d) is communicated to all staff levels and contractors; (e) its implementation is supported by human and technical resources; (f) specifies the consequences of non- compliance by staff or by contractors.",
     "articles": [
      "9(4) (a)"
     ],
     "articleNums": [
      9
     ]
    },
    {
     "ref": "12.2",
     "text": "The RE has put in place indicators to monitor the implementation of the ICT security policy and exceptions from it.",
     "articles": [],
     "articleNums": []
    },
    {
     "ref": "12.3",
     "text": "The RE has defined and implemented information security measures for the assets identified in its inventory (including software, hardware and network connections) and monitor its effectiveness to be aligned with the RE's risk tolerance and covering identified potential risks (e.g. potential fraud risk and/or possible misuses and/or abuses of confidential data).",
     "articles": [],
     "articleNums": []
    },
    {
     "ref": "12.4",
     "text": "All staff upon starting employment with the entity, receive mandatory training on ICT security, and Digital Operational Resilience, and periodically thereafter, in accordance with DORA Article 13(6) and RTS RMF Article 28(2)(e). Training is commensurate to the individual's role/function, seniority, or where access to data/critical systems is elevated. ICT Third Party providers are also subject to training obligations, in accordance with Article 30(2) (i). Information Security Management 13 Identity and access management (IAM) Maturity Levels maturity level selected and reference supporting documentation. \" known weaknesses relative to the control question and maturity level selected. Please also include a description of the measures taken to address the identified weaknesses.\".",
     "articles": [
      "13(6)",
      "28(2)(e)",
      "30(2) (i)"
     ],
     "articleNums": [
      13,
      28,
      30
     ]
    },
    {
     "ref": "13.1",
     "text": "The RE maintains identity and access management policies and procedures in accordance with Article 20 RTS RMF. The policies and procedures include but are not limited to: (a) unique identity corresponding to a unique user account is assigned to each staff member of the RE or staff of the ICT third-party service providers accessing the information assets and ICT assets of the RE. Records of all identity assignments are maintained, in compliance with the applicable retention requirements. (b) Lifecycle management process for identities and accounts managing the creation, change, review and update, temporary deactivation, and termination of all accounts. Where feasible and appropriate, automated solutions for the lifecycle identity management process are deployed.",
     "articles": [
      "20"
     ],
     "articleNums": [
      20
     ]
    },
    {
     "ref": "13.2",
     "text": "The identity and access management policies and procedures, developed and documented in accordance with Article 21 RTS RMF, include: (a) The assignment of access rights to ICT assets based on need-to-know, need-to-use and least privilege principles, including for remote and emergency access. Need-to-know and need-to-use principles are implemented via defined job descriptions, which detail the extent of access required to perform the corresponding role/function. (b) The segregation of duties designed to prevent unjustified access to critical data/systems/premises or to prevent the allocation of combinations of access rights that may be used to circumvent controls. (c) A provision on user accountability, by limiting to the extent possible the use of generic and shared user accounts and ensuring that users are identifiable for the actions performed in the ICT systems at all times; (d) A provision on restrictions of access to ICT assets/data/systems/premises, setting out controls and tools to prevent unauthorised access. (e) account management procedures to grant, change or revoke access rights for user and generic accounts, including generic administrator accounts; (f) authentication methods; (i) the use of authentication methods commensurate to the ICT asset classification, and the overall risk profile of ICT assets; (ii) the use of strong authentication methods in accordance with leading practices and techniques for remote access to the RE’s network, for privileged access, for access to ICT assets supporting critical or important functions or ICT assets that are publicly accessible. (g) physical access control measures. Information Security Management 14 Patch and vulnerability management, security reviews Maturity Levels level selected and reference supporting documentation. \" known weaknesses relative to the control question and maturity level selected. Please also include a description of the measures taken to address the identified weaknesses.\".",
     "articles": [
      "21"
     ],
     "articleNums": [
      21
     ]
    },
    {
     "ref": "14.1",
     "text": "The RE maintains patch and vulnerability management controls in accordance with Article 9(2) DORA and Article 10 RTS RMF. These controls include identification, assessment, and remediation of vulnerabilities, timely application of critical and high-risk patches, and integration with the RE’s ICT risk management framework.",
     "articles": [
      "9(2)",
      "10"
     ],
     "articleNums": [
      9,
      10
     ]
    },
    {
     "ref": "14.2",
     "text": "The RE conducts digital operational resilience testing and security reviews of its ICT systems, processes, and controls regularly through independent parties in accordance with Article 24. It ensures that all ICT systems supporting critical or important functions are tested at least annually. Additionally, the RE carries out advanced threat led penetration testing (TLPT) on critical and important functions at least every three years, if applicable. Information Security Management 15 Network and end-point security (incl. remote access) Maturity Levels maturity level selected and reference supporting documentation. \" known weaknesses relative to the control question and maturity level selected. Please also include a description of the measures taken to address the identified weaknesses.\".",
     "articles": [
      "24"
     ],
     "articleNums": [
      24
     ]
    },
    {
     "ref": "15.1",
     "text": "The RE maintains network security controls in accordance Articles 13 and 14 RTS RMF. Controls include monitoring network traffic, firewalls, intrusion detection and prevention, network segmentation, and secure configuration of devices. They are integrated with the ICT risk management framework and extend to third-party providers, ensuring incidents are documented, investigated, and reported to relevant stakeholders.",
     "articles": [],
     "articleNums": []
    },
    {
     "ref": "15.2",
     "text": "All network security maintenance activities, including remote maintenance, are securely logged in accordance with Article 12 RTS RMF with records capturing relevant events, timestamps, and personnel.",
     "articles": [
      "12"
     ],
     "articleNums": [
      12
     ]
    },
    {
     "ref": "15.3",
     "text": "The RE has implemented adequate and up-to-date protection against malware (e.g. antivirus, advanced malware prevention solutions, sandboxes) which cover the endpoints (e.g. desktops, laptops, mobile devices) as well as the servers and the gateways communicating with the external world (e.g. mail gateway and web filter) in accordance with Article 11 RTS RMF. Information Security Management 16 Security event logging and monitoring Maturity Levels maturity level selected and reference supporting documentation. \" known weaknesses relative to the control question and maturity level selected. Please also include a description of the measures taken to address the identified weaknesses.\".",
     "articles": [
      "11"
     ],
     "articleNums": [
      11
     ]
    },
    {
     "ref": "16.1",
     "text": "The RE has implemented logging and monitoring of all network security events in accordance with Article 12(2) RTS RMF to safeguard against data misuse and intrusions. Logs record all relevant ICT events - including system access, configuration changes, and security incidents - capturing user or system identity, timestamp, affected components, and event outcomes. Logs are protected against tampering, access is controlled and auditable, and records are retained and readily available to support real-time monitoring and analysis.",
     "articles": [
      "12(2)"
     ],
     "articleNums": [
      12
     ]
    },
    {
     "ref": "16.2",
     "text": "The RE has implemented security event logging and monitoring using supporting technologies (e.g. SIEM) and dedicated teams (SOC/CERT) to detect, classify, manage, and report ICT related incidents in accordance with Article 17, 18 and 20.",
     "articles": [
      "17"
     ],
     "articleNums": [
      17
     ]
    },
    {
     "ref": "16.3",
     "text": "If applicable, the RE has processes to collaborate with external entities (e.g. external computer emergency teams - CERTs, governmental authorities, telecommunication providers or ISPs, etc.) whenever required to respond to common and global cybersecurity incidents. Information Security Management 17 Physical access and environmental controls Maturity Levels maturity level selected and reference supporting documentation. \" known weaknesses relative to the control question and maturity level selected. Please also include a description of the measures taken to address the identified weaknesses.\".",
     "articles": [],
     "articleNums": []
    },
    {
     "ref": "17.1",
     "text": "The RE has implemented a physical and environmental security policy that preserves the authenticity, integrity, and availability of data including provisions for securing ICT systems and data, in accordance Article 9. The policy establishes safeguards for network and data security, protection of data in use, transit and at rest and defines physical and environmental controls (which includes securing premises, data centres, and ICT assets) in accordance with Articles 18 and 35 RTS RMF. Information Security Management 18 Data classification Maturity Levels maturity level selected and reference supporting documentation. \" known weaknesses relative to the control question and maturity level selected. Please also include a description of the measures taken to address the identified weaknesses.\".",
     "articles": [
      "9"
     ],
     "articleNums": [
      9
     ]
    },
    {
     "ref": "18.1",
     "text": "The RE maintains a documented, approved and enforced data classification policies and procedures, in accordance with Article 8 DORA and Articles 5–6 RTS RMF that ensure ICT assets and information assets are classified by criticality and sensitivity.",
     "articles": [
      "8"
     ],
     "articleNums": [
      8
     ]
    },
    {
     "ref": "18.2",
     "text": "In order to properly conduct the data classification, the RE has defined clear owners of the information assets and ensured that security measures for the detection and prevention of data loss and leakages for systems and end-point devices are identified, implemented, properly managed and continuously monitored, in accordance with Article 9 (2) DORA and Article 11 RTS RMF.",
     "articles": [
      "9 (2)",
      "11"
     ],
     "articleNums": [
      9,
      11
     ]
    }
   ]
  },
  {
   "id": "4.4",
   "name": "ICT Operations",
   "capHints": [
    "ict_operations",
    "performance_capacity",
    "change_mgmt"
   ],
   "questions": [
    {
     "ref": "19.1",
     "text": "Has the Applicant ensured it has an up-to-date inventory of all ICT assets/ configuration items (software and hardware including outsourced assets) with at least the following level of detail: title, description, location, state, actual configuration, ownership and criticality of all ICT assets/ configuration items as well as their relationship among each other (e.g. upstream and downstream dependencies).",
     "articles": [],
     "articleNums": []
    },
    {
     "ref": "19.2",
     "text": "The RE has defined and implemented an ICT Asset Management Policy and Procedure in accordance with Article 8 DORA and Article 4 and 5 RTS RMF.",
     "articles": [
      "8",
      "4"
     ],
     "articleNums": [
      4,
      8
     ]
    },
    {
     "ref": "19.3",
     "text": "Secure configuration baselines and hardening rules for ICT assets are defined along with measures to regularly verify that baselines are effectively deployed in accordance with Article 11(2)(b) RTS RMF.",
     "articles": [
      "11(2)(b)"
     ],
     "articleNums": [
      11
     ]
    },
    {
     "ref": "19.4",
     "text": "Security measures are implemented to ensure that only authorised software is installed in accordance with Article 11 (2)c RTS RMF. ICT Operations 20 Availability and capacity management Maturity Levels level selected and reference supporting documentation. \" known weaknesses relative to the control question and maturity level selected. Please also include a description of the measures taken to address the identified weaknesses.\".",
     "articles": [
      "11 (2)"
     ],
     "articleNums": [
      11
     ]
    },
    {
     "ref": "20.1",
     "text": "The RE has defined and implemented a backup policy (taking into account the criticality of systems, off-site storage of backups including compliance with data classifications and media storage requirements, encryption of backups, and regular testing of backups) in accordance with Article 12.",
     "articles": [
      "12"
     ],
     "articleNums": [
      12
     ]
    },
    {
     "ref": "20.2",
     "text": "The RE has defined and implemented procedures to ensure the standard operations of ICT systems, including but not limited to job scheduling processes, and logging and monitoring of ICT systems allowing the detection, analysis and correction of errors and capacity and performance management monitoring processes to ensure system resources (e.g. CPU, RAM, Hard Disk space ...) are adequate and regularly reviewed and maintained in accordance with Article 9(2) DORA and Article 8 RTS RMF. ICT Operations 21 Incident and problem management Maturity Levels level selected and reference supporting documentation. \" known weaknesses relative to the control question and maturity level selected. Please also include a description of the measures taken to address the identified weaknesses.\".",
     "articles": [
      "9(2)",
      "8"
     ],
     "articleNums": [
      8,
      9
     ]
    },
    {
     "ref": "21.1",
     "text": "The RE has defined and implemented an ICT-related incident management policy and process to detect, manage and notify ICT-related incidents in accordance with Article 17 DORA and 22 and 23 RTS RMF which include, but are not limited to: (a) procedures to identify, track, log, categorise and classify ICT-related incidents according to their priority and severity and according to the criticality of the services impacted. (b) Early warning indicators and denied roles and responsibilities for different incident types and scenarios. (c) Major incident reporting procedures are also established in accordance with Article 19 DORA; (d) A communication strategy for ICT-related incidents in accordance with Article 14(3) DORA and Article 6(8)(h) DORA).",
     "articles": [
      "17",
      "19",
      "14(3)",
      "6(8)(h)"
     ],
     "articleNums": [
      6,
      14,
      17,
      19
     ]
    },
    {
     "ref": "21.2",
     "text": "The RE has a defined, documented and implemented a problem management process ensure that root causes are identified, documented and addressed to prevent reoccurrence in accordance with Article 17. ICT Operations 22 ICT change and release management Maturity Levels level selected and reference supporting documentation. \" known weaknesses relative to the control question and maturity level selected. Please also include a description of the measures taken to address the identified weaknesses.\".",
     "articles": [
      "17"
     ],
     "articleNums": [
      17
     ]
    },
    {
     "ref": "22.1",
     "text": "The RE has a defined, documented and implemented policies, procedures and controls for ICT change management in accordance with Article 9(4)(e) DORA and Article 17 RTS RMF. The policies and procedures encompass changes to software, hardware, firmware components, systems or security parameters. A risk- based approach for all ICT changes is in place to ensure all changes to ICT systems are recorded, tested, assessed, approved, implemented and verified in a controlled manner.",
     "articles": [
      "9(4)(e)",
      "17"
     ],
     "articleNums": [
      9,
      17
     ]
    },
    {
     "ref": "22.2",
     "text": "The ICT change management procedures are developed in accordance with Article 17 RTS RMF: (a) verification that ICT security requirements are met for each change; (b) mechanisms to ensure the independence of the functions that approve changes and the functions responsible for requesting and implementing those changes; (c) clearly defined roles and responsibilities (including but not limited to those of production, deployment, release management, information security and quality assurance teams, and change governance committees); (d) documentation and communication of change details; (e) fall-back procedures and responsibilities; (f) procedures to manage emergency changes; (g) procedures to document, re-evaluate, assess, and approve emergency changes after their implementation, including workarounds and patches; (h) identification of the potential impact of a change on existing ICT security measures and assessment of whether additional ICT security measures are required.",
     "articles": [
      "17"
     ],
     "articleNums": [
      17
     ]
    },
    {
     "ref": "22.3",
     "text": "Segregation of duties controls are clearly defined and ensure the independence of the functions that approve changes and the functions responsible for requesting and implementing those changes, in accordance with Article 17(1)(b).",
     "articles": [
      "17(1)(b)"
     ],
     "articleNums": [
      17
     ]
    },
    {
     "ref": "22.4",
     "text": "Controls are in place to ensure that development and test environments do not contain confidential production data and test environments adequately reflect the production environment.",
     "articles": [],
     "articleNums": []
    }
   ]
  },
  {
   "id": "4.5",
   "name": "Software Acquisition, Software Development and Project Management",
   "capHints": [
    "systems_adm",
    "project_mgmt"
   ],
   "questions": [
    {
     "ref": "23.1",
     "text": "A project management framework is in place for the management of all ICT projects covering as a minimum project objectives; roles and responsibilities; a project risk assessment; a project plan, timeframe and steps; key milestones and change management requirements as well as a proper analysis of information security requirements approved by a function that is independent from the development function.",
     "articles": [],
     "articleNums": []
    },
    {
     "ref": "23.2",
     "text": "The RE has a defined, documented and implemented an ICT project management policy in accordance with Article 15 RTS RMF, to ensure the effective management of ICT projects. The policy includes, but is not limited to the following elements: ICT project objectives; ICT project governance including roles and responsibilities; ICT project planning, timeframe and steps; identification of key stakeholders, resources and expertise required, ICT project risk assessment; relevant milestones; change management requirements, security requirements, the testing of all requirements, the approval process for deployment to production, and the identification and management of project dependencies.",
     "articles": [
      "15"
     ],
     "articleNums": [
      15
     ]
    },
    {
     "ref": "23.3",
     "text": "The ICT project management policy contains governance processes to support the management and monitoring of ICT projects (e.g. project management office, an ICT steering committee, independent quality assurance process) including reporting to the management body on the progress of ICT projects (impacting CIF's) and the associated risks in accordance with Article 15 (5) RTS RMF. Software Acquisition, Software Development and Project Management 24 ICT systems acquisition, development, and maintenance Maturity Levels level selected and reference supporting documentation. \" known weaknesses relative to the control question and maturity level selected. Please also include a description of the measures taken to address the identified weaknesses.\".",
     "articles": [
      "15 (5)"
     ],
     "articleNums": [
      15
     ]
    },
    {
     "ref": "24.1",
     "text": "The RE has a defined, documented and implemented a policy to govern the acquisition, development, and maintenance of ICT systems in accordance with Article 16 RTS RMF. The policy applies to all end user computing applications supporting critical or important functions.",
     "articles": [
      "16"
     ],
     "articleNums": [
      16
     ]
    },
    {
     "ref": "24.2",
     "text": "An ICT systems’ acquisition, development, and maintenance procedure is documented and implemented for the testing and approval of all ICT systems prior to their use and after maintenance in accordance with Article 8 (2) (b)(v, vi and vii) & Article 16 RTS RMF. The level of testing shall be commensurate to the criticality of the business procedures and ICT assets concerned.",
     "articles": [
      "8 (2) (b)",
      "16"
     ],
     "articleNums": [
      8,
      16
     ]
    }
   ]
  },
  {
   "id": "4.6",
   "name": "Data Quality Management",
   "capHints": [
    "data_mgmt"
   ],
   "questions": [
    {
     "ref": "25.1",
     "text": "The RE has defined, documented and tested data quality management procedures in accordance with Article 9(3). Data quality management procedures include ICT controls (e.g. automated input validation controls, data transfer controls, reconciliation, etc.) for the different phases of the ICT data life cycle (e.g. designing the data architecture, building the data model and/or data dictionaries, verifying data inputs, controlling data extractions, transfers and processing, including rendered data outputs, backup, etc). Data quality management procedures also apply to End User Computing (EUC).",
     "articles": [
      "9(3)"
     ],
     "articleNums": [
      9
     ]
    },
    {
     "ref": "25.2",
     "text": "Roles and responsibilities regarding data quality are clearly defined and implemented, including local data owners and a data governance function (e.g. Chief Data Office/r), responsible for: (a) issuing policies and guidelines; (b) overseeing proper implementation of the data governance and quality framework throughout the organisation; (c) ensuring the evaluation and monitoring of data quality through data quality processes; and (d) participating in relevant change management processes (such as the mergers or acquisitions of material legal entities, outsourcing of services to third parties, the launch of new products and ICT change initiatives).",
     "articles": [],
     "articleNums": []
    },
    {
     "ref": "25.3",
     "text": "A formalised policy for management of End User Computing (EUC), for example to correctly identify, classify and protect all critical EUC assets and EUC-generated data, is in place and covers all business areas. Data quality management - Please note that this refers to risk, regulatory and financial reporting data 26 Data architecture model Maturity Levels level selected and reference supporting documentation. \" weaknesses relative to the control question and maturity level selected. Please also include a description of the measures taken to address the identified weaknesses.\".",
     "articles": [],
     "articleNums": []
    },
    {
     "ref": "26.1",
     "text": "The RE has a defined and documented data architecture, data models and data flows that include data taxonomies/ dictionaries of the main business concepts, which cover all material legal entities, business lines and material risks. The data architecture is regularly reviewed.",
     "articles": [],
     "articleNums": []
    }
   ]
  },
  {
   "id": "4.7",
   "name": "ICT Continuity Management",
   "capHints": [
    "disaster_recovery"
   ],
   "questions": [
    {
     "ref": "27.1",
     "text": "The RE conducts a business impact analysis (BIA) of their exposures to severe business disruptions in accordance with Article 11(5). Under the BIA, the RE assess the potential impact of severe business disruptions by means of quantitative and qualitative criteria, using internal and external data and scenario analysis, as appropriate. The BIA considers the criticality of identified and mapped business functions, support processes, third- party dependencies and information assets, and their interdependencies. Financial entities shall ensure that ICT assets and ICT services are designed and used in full alignment with the BIA, in particular with regard to adequately ensuring the redundancy of all critical components. ICT Continuity Management 28 ICT business continuity policy and planning Maturity Levels maturity level selected and reference supporting documentation. \" weaknesses relative to the control question and maturity level selected. Please also include a description of the measures taken to address the identified weaknesses.\".",
     "articles": [
      "11(5)"
     ],
     "articleNums": [
      11
     ]
    },
    {
     "ref": "28.1",
     "text": "The RE has in place an ICT business continuity policy forming an integral part of the overall business continuity policy in accordance with Article 11 DORA and Article 24 RTF RMF. The ICT business continuity policy includes the following key requirements: (a) policy objectives, scope, plans, procedures and mechanism; (b) to conduct a business impact analysis; (c) criteria to activate and deactivate all identified plans (Business continuity plans, ICT response and recovery plans and crisis communication plans) (d) governance and organisation, roles and responsibilities, and escalation procedures to implement the policy; (e) alignment of the policy to the communication policy; (f) the alignment between the ICT business continuity plans and the overall business continuity plans, concerning potential failure scenarios, including the scenarios referred to in Article 26(2) of the RTS on ICT risk management, specifying that the RE shall be able to recover the operations of its critical or important functions after disruptions within a recovery time objective and a recovery point objective; (g) the development of ICT business continuity plans for severe business disruptions, and the prioritisation of ICT business continuity actions using a risk-based approach; (h) the development, testing and review of ICT response and recovery plans, in accordance with Articles 25 and 26 of the RTS on ICT risk management; (i) the review of the effectiveness of the implemented ICT business continuity arrangements, plans, procedures and mechanisms, in accordance with Article 26 RTS RMF.",
     "articles": [
      "11",
      "24",
      "26(2)",
      "26"
     ],
     "articleNums": [
      11,
      24,
      26
     ]
    },
    {
     "ref": "28.2",
     "text": "The RE has implemented the ICT business continuity policy in accordance with Article 11(2) DORA aiming to: (a) ensure the continuity of the RE’s critical or important functions; (b) respond to, and resolve, all ICT- related incidents in a way that limits damage and prioritises the resumption of activities and recovery actions; (c) activate dedicated plans that enable containment measures, processes and technologies suited to each type of ICT-related incident (d) estimate preliminary impacts, damages and losses; (e) set out communication and crisis management actions that ensure that updated information is transmitted to all relevant internal staff and external stakeholders and the competent authorities.",
     "articles": [
      "11(2)"
     ],
     "articleNums": [
      11
     ]
    },
    {
     "ref": "28.3",
     "text": "The RE maintains and periodically tests ICT business continuity plans, with regard to critical or important functions outsourced or contracted through arrangements with ICT third- party service providers, in accordance with Article 11 (4) DORA and Article 25 RTS RMF.",
     "articles": [
      "11 (4)",
      "25"
     ],
     "articleNums": [
      11,
      25
     ]
    },
    {
     "ref": "28.4",
     "text": "The RE has implemented ICT response and recovery plans which are subject to independent internal audit reviews, in accordance with Article 11(3).",
     "articles": [
      "11(3)"
     ],
     "articleNums": [
      11
     ]
    },
    {
     "ref": "28.5",
     "text": "The ICT response and recovery plans takes into account all the following, in accordance with Article 11(3) DORA and Article 26 RTS RMF: (a) the conditions prompting their activation or deactivation, and any exceptions for such activation or deactivation; (b) describe what actions are to be taken to ensure the availability, integrity, continuity, and recovery of at least ICT systems and services supporting critical or important functions of the RE; (c) designed to meet the recovery objectives of the operations of the financial entities; (d) documented and made available to the staff involved in the execution of ICT response and recovery plans and be readily accessible in case of emergency, clearly specifying roles and responsibilities; (e) provide for both short-term and long-term recovery options, including partial systems recovery; (f) include the objectives of ICT response and recovery plans and the conditions to declare a successful execution of those plans; (g) scenarios of severe business disruption such as: - cyber attacks and switch-overs between primary ICT infrastructure and redundant facilities, - quality of critical or important function deteriorates to unacceptable levels or fails, - substantial failure of ICT assets or communication infrastructure, - non-availability of critical number of staff, - impact of climate change and environment degradation, natural disasters, -insider attacks, - political and social instability, - widespread power outage.",
     "articles": [
      "11(3)",
      "26"
     ],
     "articleNums": [
      11,
      26
     ]
    },
    {
     "ref": "28.6",
     "text": "The RE's ICT response and recovery plans consider alternative options, where the primary recovery measures may not be feasible in the short term because of costs, risks, logistics, or unforeseen circumstances, in accordance with Article 26(3) RTS RMF. ICT Continuity Management 29 ICT business continuity testing and review Maturity Levels maturity level selected and reference supporting documentation. \" weaknesses relative to the control question and maturity level selected. Please also include a description of the measures taken to address the identified weaknesses.\".",
     "articles": [
      "26(3)"
     ],
     "articleNums": [
      26
     ]
    },
    {
     "ref": "29.1",
     "text": "At least yearly, the RE tests the ICT business continuity plans and the ICT response and recovery plans in relation to ICT systems supporting all functions, as well as in the event of any substantive changes to ICT systems supporting critical or important functions, in accordance with Article 11(6). The tests assess whether the ICT systems are able to ensure the continuity of the RE's critical or important functions through including the following: (a) test scenarios simulate potential disruptions, including an adequate set of severe but plausible scenarios including those set out in the business continuity plan, (b) testing of ICT services provided by ICT third party providers, considering scenarios linked to insolvency or failures of the ICT third-party service provider; (c) contain scenarios of cyber-attacks and switchovers between the primary ICT infrastructure and the redundant capacity, backups and redundant facilities; (d) challenges the assumptions on which business continuity plans are based; (e) contains procedures to verify the ability of the RE’s staff, of ICT third- party service providers, of ICT systems, and ICT services to respond adequately to the scenarios duly taken into account in accordance with Article 26(2) of the RTS on ICT risk management framework.",
     "articles": [
      "11(6)",
      "26(2)"
     ],
     "articleNums": [
      11,
      26
     ]
    },
    {
     "ref": "29.2",
     "text": "Testing of the ICT business continuity plans is conducted and results are documented in accordance with Article 11(6) DORA and also takes into account the RE’s business impact analysis and the ICT risk assessments referred to in Article 3(1)(b) RTS RMF. Any identified deficiencies resulting from that testing are analysed, addressed, and reported to the management body.",
     "articles": [
      "11(6)",
      "3(1)(b)"
     ],
     "articleNums": [
      3,
      11
     ]
    },
    {
     "ref": "29.3",
     "text": "The RE tests the crisis communication plans established in accordance with Article 14.",
     "articles": [
      "14"
     ],
     "articleNums": [
      14
     ]
    },
    {
     "ref": "29.4",
     "text": "The RE regularly reviews its ICT business continuity policy and ICT response and recovery plans, taking into account the results of tests carried out, and recommendations stemming from audit checks or supervisory reviews, in accordance with Article 11 (6).",
     "articles": [
      "11 (6)"
     ],
     "articleNums": [
      11
     ]
    },
    {
     "ref": "29.5",
     "text": "The RE keeps readily accessible records of activities before and during disruption events when their ICT business continuity plans and ICT response and recovery plans are activated in accordance with Article 11(8). ICT Continuity Management 30 Crisis management and communication plans Maturity Levels maturity level selected and reference supporting documentation. \" weaknesses relative to the control question and maturity level selected. Please also include a description of the measures taken to address the identified weaknesses.\".",
     "articles": [
      "11(8)"
     ],
     "articleNums": [
      11
     ]
    },
    {
     "ref": "30.1",
     "text": "The RE has implemented a crisis management function, which sets out clear procedures to manage internal and external crisis communications, in the event of activation of the ICT business continuity plans or ICT response and recovery plans in accordance with Article 11(7).",
     "articles": [
      "11(7)"
     ],
     "articleNums": [
      11
     ]
    },
    {
     "ref": "30.2",
     "text": "The RE has in place crisis communication plans enabling a responsible disclosure of, at least, major ICT-related incidents or vulnerabilities to clients and counterparts as well as to the public, as appropriate, in accordance with Article 14(1). 5. ICT Risk Level Guidance.",
     "articles": [
      "14(1)"
     ],
     "articleNums": [
      14
     ]
    }
   ]
  }
 ]
};
