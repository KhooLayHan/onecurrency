import {
  Body,
  Container,
  Head,
  Html,
  Section,
  Tailwind,
  Text,
} from "@react-email/components";
import { pixelBasedPreset } from "@react-email/tailwind";

export type LayoutProps = {
  preview: string;
  children: React.ReactNode;
};

export function EmailLayout({ preview, children }: LayoutProps) {
  return (
    <Html lang="en">
      <Head>
        <title>{preview}</title>
      </Head>
      <Tailwind config={{ presets: [pixelBasedPreset] }}>
        <Body className="m-0 bg-slate-50 p-0 font-sans">
          <Container className="mx-auto max-w-150 px-4 py-8">
            {/* Header */}
            <Section className="rounded-t-xl bg-blue-600 px-8 py-6">
              <Text className="m-0 font-bold text-white text-xl tracking-tight">
                OneCurrency
              </Text>
            </Section>

            {/* Card body */}
            <Section className="rounded-b-xl border border-slate-200 border-t-0 bg-white px-8 py-8">
              {children}
            </Section>

            {/* Footer */}
            <Section className="px-8 py-6 text-center">
              <Text className="m-0 text-slate-400 text-xs">
                OneCurrency &middot; Questions? Email us at{" "}
                <a
                  className="text-slate-400 underline"
                  href="mailto:support@onecurrency.tech"
                >
                  support@onecurrency.tech
                </a>
              </Text>
              <Text className="mt-2 mb-0 text-slate-400 text-xs">
                You received this email because you have an OneCurrency account.
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
