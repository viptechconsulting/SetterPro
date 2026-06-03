export interface CaseStudy {
  title: string;
  result: string;
  metric: string;
}

export interface FAQ {
  question: string;
  answer: string;
}

export interface BrainData {
  name: string;
  product_description: string;
  icp_description: string;
  value_propositions: string[];
  case_studies: CaseStudy[];
  faqs: FAQ[];
  calendly_link: string;
  additional_context: string;
}

export interface QualificationQuestion {
  order: number;
  question: string;
  key: string;
}

export interface ObjectionHandler {
  objection: string;
  response: string;
}

export interface HandoffRule {
  trigger: string;
  action: "pause_ai" | "continue";
}

export interface SetterConfigData {
  name: string;
  language: "es" | "en" | "pt" | "fr";
  tone: "professional" | "casual" | "friendly" | "direct";
  objective: string;
  qualification_questions: QualificationQuestion[];
  objection_handlers: ObjectionHandler[];
  handoff_rules: HandoffRule[];
  min_messages_before_push: number;
  opening_message: string;
  closing_message: string;
}
