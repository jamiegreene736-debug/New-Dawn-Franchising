import { useState } from 'react';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { usePrototype } from '@/prototype/prototype-context';
import { Button, Callout, ChoiceCard, PageHeader, ProgressBar, Screen } from '@/ui/components';
import { brand, spacing, type } from '@/ui/theme';

const questions = [
  {
    title: 'Where are you in your planning?',
    body: 'This helps us suggest a practical business next step. It does not determine immigration eligibility.',
    answers: [
      ['Exploring possibilities', 'I am learning what U.S. business ownership may involve.'],
      ['Planning within 6–12 months', 'I want to compare options and build a professional team.'],
      ['Ready for professional review', 'I have counsel or want to schedule a business consultation.'],
    ],
  },
  {
    title: 'What investment range are you exploring?',
    body: 'Choose a broad range. Do not enter bank balances or source-of-funds information.',
    answers: [
      ['$100,000–$149,999', 'Early comparison range'],
      ['$150,000–$249,999', 'Core New Dawn exploration range'],
      ['$250,000 or more', 'Broader business-planning range'],
      ['I am not sure yet', 'A consultation can help clarify business options'],
    ],
  },
  {
    title: 'How involved do you want to be?',
    body: 'E-2 questions must be discussed with independent immigration counsel. We use this answer only to discuss business responsibilities.',
    answers: [
      ['Lead strategy and oversight', 'I want to direct the business and make key decisions.'],
      ['Work closely with an operating team', 'I want structured support while retaining leadership.'],
      ['I need to understand the role', 'Show me responsibilities before I decide.'],
    ],
  },
  {
    title: 'Do you already have immigration counsel?',
    body: 'New Dawn does not rank attorneys or replace independent legal advice.',
    answers: [
      ['Yes', 'I am already working with independent counsel.'],
      ['Not yet', 'I understand counsel must determine legal eligibility.'],
      ['I prefer not to answer', 'I can continue with general business education.'],
    ],
  },
] as const;

export default function InvestorAssessmentScreen() {
  const router = useRouter();
  const { completeAssessment } = usePrototype();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const current = questions[step];
  const selected = answers[step];
  const finalStep = step === questions.length - 1;

  const next = () => {
    if (selected === undefined) return;
    if (finalStep) {
      completeAssessment();
      router.replace('/investor-result');
      return;
    }
    setStep((value) => value + 1);
  };

  return (
    <Screen>
      <ProgressBar value={((step + 1) / questions.length) * 100} label={`Question ${step + 1} of ${questions.length}`} />
      <PageHeader eyebrow="BUSINESS READINESS" title={current.title} body={current.body} />
      {step === 0 ? <Callout title="General business education only" body="Your result organizes business next steps. It is not a visa evaluation, approval prediction, or legal recommendation." tone="warning" /> : null}
      <View style={styles.answerList} accessibilityRole="radiogroup">
        {current.answers.map(([title, body], index) => <ChoiceCard key={title} title={title} body={body} selected={selected === index} onPress={() => setAnswers((value) => ({ ...value, [step]: index }))} />)}
      </View>
      <Button label={finalStep ? 'See my business alignment' : 'Continue'} onPress={next} disabled={selected === undefined} testID="assessment-next" />
      {step > 0 ? <Button label="Back" variant="quiet" onPress={() => setStep((value) => value - 1)} /> : null}
      <Text style={styles.privacy}>Prototype responses stay on this device session and are not sent to New Dawn.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  answerList: { gap: spacing.sm },
  privacy: { ...type.caption, color: brand.slate, textAlign: 'center' },
});
