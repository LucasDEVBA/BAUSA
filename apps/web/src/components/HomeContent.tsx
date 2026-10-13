"use client";

import { lazy, Suspense } from "react";
import HeroSection from "@/components/HeroSection";

const StoriesRail = lazy(() => import("@/components/StoriesRail"));
const WhatIsEEISection = lazy(() => import("@/components/WhatIsEEISection"));
const SAFEMethodSection = lazy(() => import("@/components/SAFEMethodSection"));
const TestimonialsCarousel = lazy(() => import("@/components/TestimonialsCarousel"));
const WhyHighSchoolSection = lazy(() => import("@/components/WhyHighSchoolSection"));
const HowWeWorkSection = lazy(() => import("@/components/HowWeWorkSection"));
const FounderSection = lazy(() => import("@/components/FounderSection"));
const InstitutionalRecognitionSection = lazy(() => import("@/components/InstitutionalRecognitionSection"));
const ParentTestimonialsSection = lazy(() => import("@/components/ParentTestimonialsSection"));
const FinalCTA = lazy(() => import("@/components/FinalCTA"));

// Header, Footer, dock e o motor de movimento vêm do layout (site), persistentes entre páginas
export default function HomeContent() {
  return (
    <>
      <HeroSection>
        <Suspense fallback={null}>
          <StoriesRail />
        </Suspense>
      </HeroSection>

      <Suspense fallback={null}>
        <WhatIsEEISection />
        <SAFEMethodSection />
        <TestimonialsCarousel />
        <WhyHighSchoolSection />
        <HowWeWorkSection />
        <FounderSection />
        <InstitutionalRecognitionSection />
        <ParentTestimonialsSection />
        <FinalCTA />
      </Suspense>
    </>
  );
}
