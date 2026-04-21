# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: booking-service-step.spec.ts >> Booking Service Step — Section 15 >> 15.3 — toggling service off removes selection styling
- Location: __tests__\e2e\booking-service-step.spec.ts:164:7

# Error details

```
Error: expect(received).not.toContain(expected) // indexOf

Expected substring: not "border-gold"
Received string:        "flex items-center justify-between rounded-xl px-4 py-3.5 transition-all duration-250 border-[1.5px] border-gold bg-gold shadow-[0_2px_8px_rgb(192_154_90/10%)]"
```

# Page snapshot

```yaml
- generic [ref=e1]:
  - navigation [ref=e2]:
    - generic [ref=e3]:
      - img "Desart" [ref=e4]
      - text: DESART
  - generic [ref=e5]:
    - generic [ref=e6]:
      - generic [ref=e7]: Agadir · Est. 2019
      - heading "Sharp cuts. Sharper style." [level=1] [ref=e8]:
        - text: Sharp cuts.
        - text: Sharper
        - emphasis [ref=e9]: style.
      - paragraph [ref=e10]: Premium grooming for those who know the difference. Walk in, sit down, walk out sharper — by appointment or by chance.
      - generic [ref=e11]:
        - button "Reserve a chair" [ref=e12]:
          - text: Reserve a chair
          - img [ref=e13]
        - link "View menu" [ref=e15] [cursor=pointer]:
          - /url: "#services"
      - generic [ref=e16]:
        - generic [ref=e17]:
          - generic [ref=e18]: Hours
          - generic [ref=e19]: 9:00 — 17:00
        - generic [ref=e20]:
          - generic [ref=e21]: Closed
          - generic [ref=e22]: Friday
        - generic [ref=e23]:
          - generic [ref=e24]: Payment
          - generic [ref=e25]: Cash only
    - generic [ref=e28]:
      - generic [ref=e30]:
        - generic [ref=e31]:
          - generic: Timeless Precision
          - generic:
            - generic:
              - generic:
                - generic: The Classic Cut — Where Tradition Meets Modern Elegance
        - generic [ref=e33]:
          - generic: Sharp & Refined
          - generic:
            - generic:
              - generic:
                - generic: Skin Fade Mastery — Clean Lines, Bold Statements
        - generic [ref=e35]:
          - generic: Precision Crafted
          - generic:
            - generic:
              - generic:
                - generic: Beard Sculpting — Artistry in Every Detail
        - generic [ref=e37]:
          - generic: Pure Luxury
          - generic:
            - generic:
              - generic:
                - generic: Hot Towel Ritual — The Ultimate Grooming Experience
        - generic [ref=e39]:
          - generic: Timeless Precision
          - generic:
            - generic:
              - generic:
                - generic: The Classic Cut — Where Tradition Meets Modern Elegance
        - generic [ref=e41]:
          - generic: Sharp & Refined
          - generic:
            - generic:
              - generic:
                - generic: Skin Fade Mastery — Clean Lines, Bold Statements
        - generic [ref=e43]:
          - generic: Precision Crafted
          - generic:
            - generic:
              - generic:
                - generic: Beard Sculpting — Artistry in Every Detail
        - generic [ref=e45]:
          - generic: Pure Luxury
          - generic:
            - generic:
              - generic:
                - generic: Hot Towel Ritual — The Ultimate Grooming Experience
      - generic [ref=e48]:
        - generic [ref=e49]:
          - generic: Sharp & Refined
          - generic:
            - generic:
              - generic:
                - generic: Skin Fade Mastery — Clean Lines, Bold Statements
        - generic [ref=e51]:
          - generic: Pure Luxury
          - generic:
            - generic:
              - generic:
                - generic: Hot Towel Ritual — The Ultimate Grooming Experience
        - generic [ref=e53]:
          - generic: Timeless Precision
          - generic:
            - generic:
              - generic:
                - generic: The Classic Cut — Where Tradition Meets Modern Elegance
        - generic [ref=e55]:
          - generic: Precision Crafted
          - generic:
            - generic:
              - generic:
                - generic: Beard Sculpting — Artistry in Every Detail
        - generic [ref=e57]:
          - generic: Sharp & Refined
          - generic:
            - generic:
              - generic:
                - generic: Skin Fade Mastery — Clean Lines, Bold Statements
        - generic [ref=e59]:
          - generic: Pure Luxury
          - generic:
            - generic:
              - generic:
                - generic: Hot Towel Ritual — The Ultimate Grooming Experience
        - generic [ref=e61]:
          - generic: Timeless Precision
          - generic:
            - generic:
              - generic:
                - generic: The Classic Cut — Where Tradition Meets Modern Elegance
        - generic [ref=e63]:
          - generic: Precision Crafted
          - generic:
            - generic:
              - generic:
                - generic: Beard Sculpting — Artistry in Every Detail
      - generic [ref=e66]:
        - generic [ref=e67]:
          - generic: Precision Crafted
          - generic:
            - generic:
              - generic:
                - generic: Beard Sculpting — Artistry in Every Detail
        - generic [ref=e69]:
          - generic: Timeless Precision
          - generic:
            - generic:
              - generic:
                - generic: The Classic Cut — Where Tradition Meets Modern Elegance
        - generic [ref=e71]:
          - generic: Pure Luxury
          - generic:
            - generic:
              - generic:
                - generic: Hot Towel Ritual — The Ultimate Grooming Experience
        - generic [ref=e73]:
          - generic: Sharp & Refined
          - generic:
            - generic:
              - generic:
                - generic: Skin Fade Mastery — Clean Lines, Bold Statements
        - generic [ref=e75]:
          - generic: Precision Crafted
          - generic:
            - generic:
              - generic:
                - generic: Beard Sculpting — Artistry in Every Detail
        - generic [ref=e77]:
          - generic: Timeless Precision
          - generic:
            - generic:
              - generic:
                - generic: The Classic Cut — Where Tradition Meets Modern Elegance
        - generic [ref=e79]:
          - generic: Pure Luxury
          - generic:
            - generic:
              - generic:
                - generic: Hot Towel Ritual — The Ultimate Grooming Experience
        - generic [ref=e81]:
          - generic: Sharp & Refined
          - generic:
            - generic:
              - generic:
                - generic: Skin Fade Mastery — Clean Lines, Bold Statements
  - generic [ref=e84]:
    - generic [ref=e85]:
      - generic [ref=e86]:
        - generic [ref=e87]: What We Do
        - heading "Services" [level=2] [ref=e88]
      - paragraph [ref=e89]: Cash only. Same-day booking available.
    - generic [ref=e90]:
      - generic [ref=e91]:
        - generic [ref=e92]: Beard Trim
        - generic [ref=e93]: Lines, edges, and shape.
        - generic [ref=e94]:
          - generic [ref=e95]: 50 MAD
          - generic [ref=e96]: 30 min
      - generic [ref=e97]:
        - generic [ref=e98]: Classic Cut
        - generic [ref=e99]: Scissors or clippers, shaped to you.
        - generic [ref=e100]:
          - generic [ref=e101]: 60 MAD
          - generic [ref=e102]: 45 min
      - generic [ref=e103]:
        - generic [ref=e104]: Hot Towel Shave
        - generic [ref=e105]: Hot towel, straight razor.
        - generic [ref=e106]:
          - generic [ref=e107]: 80 MAD
          - generic [ref=e108]: 45 min
      - generic [ref=e109]:
        - generic [ref=e110]: Skin Fade
        - generic [ref=e111]: Clean gradient, razor-sharp lines.
        - generic [ref=e112]:
          - generic [ref=e113]: 100 MAD
          - generic [ref=e114]: 60 min
  - generic [ref=e116]:
    - generic [ref=e117]: Precision Fades
    - generic [ref=e119]: Classic Cuts
    - generic [ref=e121]: Beard Sculpting
    - generic [ref=e123]: Hot Towel Shaves
    - generic [ref=e125]: Cash Only · No Fuss
    - generic [ref=e127]: Same Day Booking
    - generic [ref=e129]: Agadir Finest
    - generic [ref=e131]: Precision Fades
    - generic [ref=e133]: Classic Cuts
    - generic [ref=e135]: Beard Sculpting
    - generic [ref=e137]: Hot Towel Shaves
    - generic [ref=e139]: Cash Only · No Fuss
    - generic [ref=e141]: Same Day Booking
    - generic [ref=e143]: Agadir Finest
  - generic [ref=e146]:
    - generic [ref=e148]:
      - generic [ref=e149]: The Craftsmen
      - heading "Meet Our Team" [level=2] [ref=e150]:
        - text: Meet Our
        - emphasis [ref=e151]: Team
      - paragraph [ref=e152]: Every one of our barbers brings a distinct edge. Pick your style, pick your pro.
    - generic [ref=e153]:
      - generic [ref=e154]:
        - img "Ahmed" [ref=e156]
        - generic [ref=e158]:
          - generic [ref=e159]: Ahmed
          - generic [ref=e160]: barber · 10 Yrs
          - generic [ref=e161]:
            - generic [ref=e162]: Beard Trim
            - generic [ref=e163]: Classic Cut
            - generic [ref=e164]: Hot Towel Shave
      - generic [ref=e165]:
        - img "Anas Tog" [ref=e167]
        - generic [ref=e169]:
          - generic [ref=e170]: Anas Tog
          - generic [ref=e171]: barber · 4 Yrs
          - generic [ref=e173]: Classic Cut
      - generic [ref=e174]:
        - img "test" [ref=e176]
        - generic [ref=e178]:
          - generic [ref=e179]: test
          - generic [ref=e180]: barber · 7 Yrs
          - generic [ref=e182]: Classic Cut
  - generic [ref=e184]:
    - paragraph [ref=e185]:
      - text: Your chair is waiting. Your best look is one appointment
      - emphasis [ref=e186]: away.
    - text: Desart — Agadir, Since 2019
  - generic [ref=e188]:
    - generic [ref=e189]:
      - generic [ref=e190]:
        - generic [ref=e191]: Find Us
        - heading "Our Locations" [level=2] [ref=e192]:
          - text: Our
          - emphasis [ref=e193]: Locations
      - paragraph [ref=e194]: Visit us at the salon or let us come to you — your call.
    - generic [ref=e195]:
      - generic [ref=e196]:
        - heading "Desart Salon" [level=3] [ref=e197]
        - generic [ref=e198]: Flagship Location
        - generic [ref=e199]:
          - img [ref=e200]
          - paragraph [ref=e203]:
            - text: 14 Rue Mohammed V, Medína
            - text: Agadir 40000, Morocco
        - generic [ref=e204]:
          - img [ref=e205]
          - paragraph [ref=e207]: +212 600 000 000
        - generic [ref=e208]:
          - generic [ref=e209]:
            - generic [ref=e210]: Saturday – Thursday
            - generic [ref=e211]: 9:00 – 17:00
          - generic [ref=e212]:
            - generic [ref=e213]: Friday
            - generic [ref=e214]: Closed
        - button "Book This Location →" [ref=e215] [cursor=pointer]
      - generic [ref=e216]:
        - heading "Home Visit" [level=3] [ref=e217]
        - generic [ref=e218]: +30 MAD Travel Fee
        - generic [ref=e219]:
          - img [ref=e220]
          - paragraph [ref=e223]: We travel anywhere within Agadir city limits. Just provide your address at booking.
        - generic [ref=e224]:
          - img [ref=e225]
          - paragraph [ref=e228]: Sat–Thu · 9:00 – 17:00. Same barbers, same quality, at your door.
        - generic [ref=e229]:
          - img [ref=e230]
          - paragraph [ref=e233]: Cash payment on the day. No card required at booking.
        - button "Book Home Visit →" [ref=e234] [cursor=pointer]
  - contentinfo [ref=e235]:
    - generic [ref=e236]:
      - generic [ref=e237]:
        - generic [ref=e238]:
          - generic [ref=e239]: DESART
          - paragraph [ref=e240]: Premium barbershop experience in the heart of Agadir. Walk-ins welcome, appointments preferred. Cash only — always.
        - generic [ref=e241]:
          - heading "Navigate" [level=4] [ref=e242]
          - list [ref=e243]:
            - listitem [ref=e244]:
              - link "Services" [ref=e245] [cursor=pointer]:
                - /url: "#services"
            - listitem [ref=e246]:
              - link "Our Team" [ref=e247] [cursor=pointer]:
                - /url: "#team"
            - listitem [ref=e248]:
              - link "Locations" [ref=e249] [cursor=pointer]:
                - /url: "#locations"
            - listitem [ref=e250]:
              - button "Book Now" [ref=e251]
        - generic [ref=e252]:
          - heading "Contact" [level=4] [ref=e253]
          - list [ref=e254]:
            - listitem [ref=e255]: 14 Rue Mohammed V, Agadir
            - listitem [ref=e256]:
              - link "+212 600 000 000" [ref=e257] [cursor=pointer]:
                - /url: tel:+212600000000
            - listitem [ref=e258]: "Sat–Thu: 9:00 – 17:00"
            - listitem [ref=e259]: "Friday: Closed"
      - generic [ref=e260]:
        - paragraph [ref=e261]: © 2026 Desart. Cash only · Agadir, Morocco
        - link "Instagram" [ref=e263] [cursor=pointer]:
          - /url: "#"
          - img [ref=e264]
  - generic [ref=e271] [cursor=pointer]:
    - button "Open Next.js Dev Tools" [ref=e272]:
      - img [ref=e273]
    - generic [ref=e276]:
      - button "Open issues overlay" [ref=e277]:
        - generic [ref=e278]:
          - generic [ref=e279]: "5"
          - generic [ref=e280]: "6"
        - generic [ref=e281]:
          - text: Issue
          - generic [ref=e282]: s
      - button "Collapse issues badge" [ref=e283]:
        - img [ref=e284]
  - alert [ref=e286]
  - dialog [ref=e287]:
    - generic [ref=e288]:
      - button "Go back" [ref=e289] [cursor=pointer]:
        - img [ref=e290]
      - paragraph [ref=e293]: Choose a Time
      - button "Open menu" [ref=e294] [cursor=pointer]:
        - img [ref=e295]
      - button "Close" [ref=e297] [cursor=pointer]:
        - img [ref=e298]
    - generic [ref=e302]:
      - button "Beard Trim 30 min 50 MAD" [active] [ref=e303]:
        - generic [ref=e304]:
          - generic [ref=e305]: Beard Trim
          - generic [ref=e306]: 30 min
        - generic [ref=e307]: 50 MAD
      - button "Classic Cut 45 min 60 MAD" [ref=e308]:
        - generic [ref=e309]:
          - generic [ref=e310]: Classic Cut
          - generic [ref=e311]: 45 min
        - generic [ref=e312]: 60 MAD
      - button "Hot Towel Shave 45 min 80 MAD" [ref=e313]:
        - generic [ref=e314]:
          - generic [ref=e315]: Hot Towel Shave
          - generic [ref=e316]: 45 min
        - generic [ref=e317]: 80 MAD
```

# Test source

```ts
  106 |     await service1Btn.click();
  107 |     await page.waitForTimeout(500);
  108 | 
  109 |     // Go back to select another service
  110 |     await page.getByRole('button', { name: 'Go back' }).click();
  111 |     await page.waitForTimeout(800);
  112 | 
  113 |     // Select second service
  114 |     const service2Btn = page.getByTestId(`btn:service-${serviceIds[1]}`);
  115 |     await service2Btn.waitFor({ state: 'visible', timeout: 10000 });
  116 |     await service2Btn.click();
  117 |     await page.waitForTimeout(500);
  118 | 
  119 |     // Both services should be selected (have gold/highlighted styling)
  120 |     const service1Selected = await service1Btn.getAttribute('class');
  121 |     const service2Selected = await service2Btn.getAttribute('class');
  122 | 
  123 |     // Both should have the gold selection class
  124 |     expect(service1Selected).toContain('border-gold');
  125 |     expect(service2Selected).toContain('border-gold');
  126 | 
  127 |     // Auto-advance to step 4
  128 |     await page.waitForTimeout(1000);
  129 |     await expect(page.locator('#panel-title')).toContainText('Choose a Time');
  130 |   });
  131 | 
  132 |   // 15.2 Zero services → next button disabled (auto-advance doesn't happen)
  133 |   test('15.2 — zero services selected does not auto-advance', async ({
  134 |     authenticatedPage,
  135 |   }) => {
  136 |     const page = authenticatedPage;
  137 | 
  138 |     await page.goto('/');
  139 |     await page.getByTestId('btn:open-booking').first().click();
  140 |     await page.waitForSelector('[role="dialog"]', { state: 'visible' });
  141 | 
  142 |     // Step 1: select salon
  143 |     await page.waitForTimeout(500);
  144 |     const locationBtn = page.getByTestId(`btn:location-${salonId}`);
  145 |     await locationBtn.waitFor({ state: 'visible', timeout: 10000 });
  146 |     await locationBtn.click();
  147 |     await page.waitForTimeout(1000);
  148 | 
  149 |     // Step 2: select barber
  150 |     const barberBtn = page.getByTestId(`btn:barber-${barberId}`);
  151 |     await barberBtn.waitFor({ state: 'visible', timeout: 10000 });
  152 |     await barberBtn.click();
  153 |     await page.waitForTimeout(1000);
  154 | 
  155 |     // Step 3: we should be on service step, but without selecting any service
  156 |     await expect(page.locator('#panel-title')).toContainText('Choose a Service');
  157 | 
  158 |     // Wait longer than the auto-advance timeout (500ms) and verify we're still on step 3
  159 |     await page.waitForTimeout(1500);
  160 |     await expect(page.locator('#panel-title')).toContainText('Choose a Service');
  161 |   });
  162 | 
  163 |   // 15.3 Toggling a service off updates totals instantly
  164 |   test('15.3 — toggling service off removes selection styling', async ({
  165 |     authenticatedPage,
  166 |   }) => {
  167 |     const page = authenticatedPage;
  168 | 
  169 |     await page.goto('/');
  170 |     await page.getByTestId('btn:open-booking').first().click();
  171 |     await page.waitForSelector('[role="dialog"]', { state: 'visible' });
  172 | 
  173 |     // Step 1: select salon
  174 |     await page.waitForTimeout(500);
  175 |     const locationBtn = page.getByTestId(`btn:location-${salonId}`);
  176 |     await locationBtn.waitFor({ state: 'visible', timeout: 10000 });
  177 |     await locationBtn.click();
  178 |     await page.waitForTimeout(1000);
  179 | 
  180 |     // Step 2: select barber
  181 |     const barberBtn = page.getByTestId(`btn:barber-${barberId}`);
  182 |     await barberBtn.waitFor({ state: 'visible', timeout: 10000 });
  183 |     await barberBtn.click();
  184 |     await page.waitForTimeout(1000);
  185 | 
  186 |     // Step 3: select first service
  187 |     const service1Btn = page.getByTestId(`btn:service-${serviceIds[0]}`);
  188 |     await service1Btn.waitFor({ state: 'visible', timeout: 10000 });
  189 |     await service1Btn.click();
  190 |     await page.waitForTimeout(500);
  191 | 
  192 |     // Verify it's selected
  193 |     let cls = await service1Btn.getAttribute('class');
  194 |     expect(cls).toContain('border-gold');
  195 | 
  196 |     // Go back and toggle it off
  197 |     await page.getByRole('button', { name: 'Go back' }).click();
  198 |     await page.waitForTimeout(800);
  199 | 
  200 |     // Click the same service again to deselect
  201 |     await service1Btn.click();
  202 |     await page.waitForTimeout(500);
  203 | 
  204 |     // Verify it's no longer selected
  205 |     cls = await service1Btn.getAttribute('class');
> 206 |     expect(cls).not.toContain('border-gold');
      |                     ^ Error: expect(received).not.toContain(expected) // indexOf
  207 | 
  208 |     // Should stay on step 3 (no auto-advance with 0 services)
  209 |     await page.waitForTimeout(1000);
  210 |     await expect(page.locator('#panel-title')).toContainText('Choose a Service');
  211 |   });
  212 | });
  213 | 
```