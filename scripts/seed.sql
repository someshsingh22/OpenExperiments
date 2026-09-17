-- Seed data for OpenExperiments D1 database
-- Converted from TypeScript mock data files

-- System user for seeded data
INSERT INTO users (id, google_id, email, name, avatar_url, created_at, updated_at)
VALUES ('system', 'system', 'system@openexperiments.ai', 'System', NULL, 1726358400, 1726358400);

-- Problem Statements
INSERT INTO problem_statements (id, question, description, domain, hypothesis_count, created_at, updated_at) VALUES
('ps-1', 'What makes a counterargument persuasive?', 'Exploring the linguistic, structural, and psychological factors that determine whether a counterargument successfully changes someone''s opinion in online discourse.', 'persuasion', 47, 1726358400, 1726358400),
('ps-2', 'What makes an image unforgettable?', 'Investigating the visual, compositional, and semantic properties that cause certain images to persist in human memory while others are quickly forgotten.', 'memorability', 23, 1726358400, 1726358400),
('ps-3', 'What drives opinion change in online debates?', 'Understanding which conversational strategies, timing factors, and social dynamics predict successful persuasion in threaded online discussions.', 'persuasion', 31, 1726358400, 1726358400),
('ps-4', 'How does visual context affect memorability?', 'Examining how the surrounding context, scene category, and object relationships within an image influence its memorability score.', 'memorability', 15, 1726358400, 1726358400);

-- Datasets
-- Single seed dataset: the r/ChangeMyView prospective corpus, registered as a
-- scientific instrument with an OSF-style characterization. The former ML-benchmark
-- datasets (LaMem, Twitter, Visual Attention) were removed in the OSF redesign.
INSERT INTO datasets (id, name, huggingface_url, task_description, data_column_names, target_column_name, description, domain, osf_characterization, license, foreknowledge_status, unit_of_analysis, submitted_by, created_at, updated_at) VALUES
('ds-1', 'r/ChangeMyView Persuasion Corpus', 'https://huggingface.co/datasets/changemyview/change_my_view', NULL, NULL, NULL, 'Prospectively collected corpus of r/ChangeMyView threads: original posts, root comments, and DeltaBot-confirmed view-change (delta) awards. Registered as a scientific instrument for confirmatory persuasion studies.', 'persuasion', '{"provenance":"Data is drawn from r/ChangeMyView, a public Reddit forum where a user posts an opinion and explicitly invites others to argue against it. The original poster (OP) awards a “delta” when a comment changes their view; deltas are logged automatically by the community''s DeltaBot. The corpus is collected prospectively — only threads posted after a study''s preregistration timestamp are included — so no analysis decision can be influenced by prior observation of the data.","foreknowledgeExplanation":"Each confirmatory study uses only data generated after its own registration timestamp. That timestamp is the hard boundary between the historical data used for hypothesis generation and the confirmatory data used for testing.","collectionProcedure":"Threads are harvested from public r/ChangeMyView posts. For each thread we capture the OP''s post body, every root comment (a direct reply to the OP), the OP''s replies, and DeltaBot confirmation records. View-change is detected only via DeltaBot''s confirmation reply, never by scanning comment text for the delta symbol, to avoid false positives from quoted or hypothetical uses.","startStopRules":"Collection for a given confirmatory study begins at that study''s preregistration timestamp and runs for a fixed 6-month window; only threads posted within the window are eligible.","variables":"post_id — thread identifier; the Level-2 clustering unit.\ncomment_id — root comment identifier; the unit of analysis.\ncomment_text — full text of the root comment (source for derived linguistic features).\nop_post_text — original post body; used for exclusion filtering.\ndelta — binary outcome: 1 if the OP awarded a DeltaBot-confirmed view-change to the root commenter, else 0.\npost_score — score of the original post; visibility/engagement covariate.\ncomment_timestamp / op_last_reply_timestamp — used to enforce the activity window.\nadult_content_flag — used to exclude adult-flagged posts.\nop_delta_count / op_reply_count — used for the OP-engagement filter.\nDerived features (e.g. flesch_reading_ease, log_length, linguistic-style metrics) are computed deterministically from comment_text within each individual study.","inclusionExclusion":"Post-level: exclude posts with empty, [deleted], or moderator-[removed] bodies; adult-flagged posts; and posts where the OP neither awarded any delta nor made at least 5 replies (unengaged OP). Comment-level: only root comments are eligible; comments outside the activity window (post creation to min(OP''s last reply, +7 days)) are excluded; cases where a delta was awarded to a user other than the root commenter are excluded. Temporal: threads posted before a study''s registration timestamp are excluded.","missingData":"All records meeting the inclusion criteria are used; observations with missing values in any required field are excluded implicitly by the filtering pipeline. No imputation is performed.","limitations":"Observational data — associations are not causal. Deltas are a conservative, sparse proxy for genuine view change (rare-event class imbalance, typically handled by 1:5 delta:non-delta subsampling per study). The population is self-selected users of one English-language subreddit and may not generalize to other persuasion settings.","tags":["changemyview","persuasion","reddit","delta","observational","online-deliberation"]}', 'CC0 1.0 Universal', 'data_not_exist', 'Root comment (a direct reply to the OP''s post) in a r/ChangeMyView thread', 'system', 1726358400, 1726358400);

-- Dataset <-> Problem Statement links (many-to-many)
INSERT INTO dataset_problem_statements (dataset_id, problem_statement_id) VALUES
('ds-1', 'ps-1'),
('ds-1', 'ps-3');

-- Hypotheses (submittedAt converted to Unix seconds)
INSERT INTO hypotheses (id, statement, rationale, source, agent_name, domains, problem_statement, status, phase, submitted_at, submitted_by, arena_elo, evidence_score, p_value, effect_size, comment_count, citation_dois, related_hypothesis_ids, created_at, updated_at) VALUES
('h-1', 'Counterarguments that acknowledge the original poster''s viewpoint before presenting rebuttals are significantly more persuasive than those that directly oppose.', 'When people feel heard, they become more open to alternative perspectives. Acknowledgment reduces psychological reactance and signals good faith, making the audience more receptive to the counterargument that follows.', 'ai_agent', 'ExperiGen-GPT4o', '["persuasion"]', 'What makes a counterargument persuasive?', 'field_validated', 'completed', 1726358400, 'system', 1847, 92, 0.0003, 0.41, 34, '["10.1145/3411764.3445124"]', '["h-2","h-5"]', 1726358400, 1726358400),
('h-2', 'Being among the first three responders to a post doubles the likelihood of changing the original poster''s opinion compared to later responses.', 'Early responders may benefit from anchoring effects and receive more visibility. The original poster is most engaged and open-minded shortly after posting, creating a time-sensitive window for persuasion.', 'ai_agent', 'ExperiGen-GPT4o', '["persuasion"]', 'What drives opinion change in online debates?', 'data_tested', 'completed', 1727827200, 'system', 1723, 85, 0.001, 0.38, 21, '[]', '["h-1","h-6"]', 1727827200, 1727827200),
('h-3', 'Images containing human faces in unexpected or incongruent contexts are significantly more memorable than images with faces in typical settings.', 'The human visual system is highly attuned to faces, and when faces appear in surprising contexts, the prediction error creates a stronger memory trace. This combines the face-detection bias with the novelty/surprise advantage.', 'ai_agent', 'ExperiGen-Qwen3', '["memorability"]', 'What makes an image unforgettable?', 'data_tested', 'completed', 1731024000, 'system', 1695, 78, 0.004, 0.29, 16, '["10.1167/15.12.1068"]', '["h-7","h-10"]', 1731024000, 1731024000),
('h-4', 'Expanding the perceived decision space from a binary choice to a spectrum of options is more persuasive than arguing for a single alternative position.', 'When people see an issue as binary (for/against), they entrench. Reframing the problem as a spectrum reduces the threat to identity and opens cognitive space for movement. This emerged from observing that both concessions and degree-framing are independently persuasive.', 'ai_agent', 'ExperiGen-o3', '["persuasion"]', 'What makes a counterargument persuasive?', 'data_tested', 'completed', 1729382400, 'system', 1780, 81, 0.002, 0.33, 28, '[]', '["h-1","h-5"]', 1729382400, 1729382400),
('h-5', 'Counterarguments that use specific numerical evidence or statistics are more persuasive than those relying on anecdotal evidence alone.', 'Concrete numbers provide an anchor of credibility and make claims feel more objective. People tend to trust quantified claims over narratives when evaluating factual disagreements.', 'human', NULL, '["persuasion"]', 'What makes a counterargument persuasive?', 'arena_ranked', 'live', 1733011200, 'system', 1634, NULL, NULL, NULL, 12, '[]', '["h-1","h-4"]', 1733011200, 1733011200),
('h-6', 'Responses that match the emotional register of the original post are more persuasive than those that adopt a neutral or contrasting tone.', 'Emotional mirroring builds rapport and signals understanding. If someone posts with frustration, a response that acknowledges that frustration before reasoning feels more empathetic than a detached logical rebuttal.', 'human', NULL, '["persuasion"]', 'What drives opinion change in online debates?', 'proposed', 'live', 1736467200, 'system', NULL, NULL, NULL, NULL, 5, '[]', '["h-1","h-2"]', 1736467200, 1736467200),
('h-7', 'Images with a single dominant focal point and high figure-ground contrast are more memorable than visually complex scenes with distributed attention targets.', 'A clear focal point reduces cognitive load and creates a strong, singular memory trace. Complex scenes distribute attention and may lead to weaker encoding of any single element.', 'human', NULL, '["memorability"]', 'What makes an image unforgettable?', 'arena_ranked', 'live', 1734220800, 'system', 1578, NULL, NULL, NULL, 9, '[]', '["h-3","h-10"]', 1734220800, 1734220800),
('h-8', 'Counterarguments structured as personal stories with a clear causal narrative change opinions more effectively than abstract logical arguments.', 'Narrative transportation theory suggests people are more influenced when they are absorbed in a story. A causal narrative provides both emotional resonance and logical structure simultaneously.', 'ai_agent', 'HypoGenic', '["persuasion"]', 'What makes a counterargument persuasive?', 'data_tested', 'completed', 1732233600, 'system', 1612, 64, 0.018, 0.19, 15, '["10.1037/a0021196"]', '["h-1","h-5"]', 1732233600, 1732233600),
('h-9', 'Images depicting scenes that violate physical expectations (objects in impossible positions or scales) are more memorable than images with plausible scene arrangements.', 'Violation of expectations creates prediction error in the visual processing stream, which the brain flags for deeper encoding. This is consistent with the ''surprise'' theory of memory formation.', 'human', NULL, '["memorability"]', 'How does visual context affect memorability?', 'proposed', 'live', 1738713600, 'system', NULL, NULL, NULL, NULL, 3, '[]', '["h-3"]', 1738713600, 1738713600),
('h-10', 'Images with warm color palettes (reds, oranges, yellows) are more memorable than those with cool palettes (blues, greens), controlling for content and composition.', 'Warm colors are associated with arousal and emotional significance, which may enhance memory encoding. Evolutionary psychology suggests warmer colors signal importance (fire, ripe fruit, blood).', 'ai_agent', 'ExperiGen-o3', '["memorability"]', 'What makes an image unforgettable?', 'data_tested', 'completed', 1732924800, 'system', 1540, 58, 0.032, 0.15, 7, '[]', '["h-3","h-7"]', 1732924800, 1732924800),
('h-11', 'Posts that explicitly acknowledge uncertainty in their own position are perceived as more credible and are more effective at changing minds.', 'Expressing uncertainty signals intellectual honesty and makes the arguer appear less dogmatic. Listeners may feel less threatened by someone who admits they could be wrong, lowering defensive barriers.', 'human', NULL, '["persuasion"]', 'What drives opinion change in online debates?', 'arena_ranked', 'live', 1737763200, 'system', 1489, NULL, NULL, NULL, 8, '[]', '["h-1","h-6"]', 1737763200, 1737763200),
('h-12', 'The interaction between accuracy-motivating elements and identity-relevant claims produces a non-obvious amplification of persuasive effect.', 'When a counterargument both challenges identity-relevant beliefs and provides accuracy-motivating cues (data, expert sources), the two forces interact synergistically rather than canceling out, contrary to what identity-protective cognition theory would predict.', 'ai_agent', 'ExperiGen-GPT4o', '["persuasion"]', 'What makes a counterargument persuasive?', 'data_tested', 'completed', 1730073600, 'system', 1756, 88, 0.0008, 0.36, 42, '[]', '["h-1","h-4"]', 1730073600, 1730073600);

-- Experiments — CMV only. Non-CMV experiments (Fortune 500 A/B test and the two
-- LaMem image-memorability studies) were dropped in the OSF redesign.
INSERT INTO experiments (id, hypothesis_id, type, status, dataset_id, dataset_name, methodology, started_at, completed_at, osf_link, submitted_by, created_at, updated_at) VALUES
('exp-1', 'h-1', 'observational', 'completed', 'ds-1', 'r/ChangeMyView Persuasion Corpus', 'Logistic regression on 4,000 CMV posts. Features: acknowledgment presence (LLM-annotated), argument length, citation count, response position. Covariates: topic, time of day, author karma. Bonferroni-corrected across 4 refinement steps.', 1726790400, 1726963200, 'https://osf.io/', 'system', 1726790400, 1726963200),
('exp-3', 'h-2', 'observational', 'completed', 'ds-1', 'r/ChangeMyView Persuasion Corpus', 'Within-thread ranking analysis. Computed response position for each reply. Logistic regression predicting delta-award with position rank, controlling for length, time-of-day, and author history. Bonferroni correction over 4 tests.', 1728086400, 1728172800, 'https://osf.io/', 'system', 1728086400, 1728172800),
('exp-5', 'h-4', 'observational', 'completed', 'ds-1', 'r/ChangeMyView Persuasion Corpus', 'LLM-annotated framing type (binary vs. spectrum) for 2,500 counterarguments. Logistic regression on opinion change controlling for length, acknowledgment, and citations.', 1729555200, 1729641600, 'https://osf.io/', 'system', 1729555200, 1729641600),
('exp-6', 'h-12', 'observational', 'completed', 'ds-1', 'r/ChangeMyView Persuasion Corpus', 'Interaction analysis between accuracy-motivating elements (citations, data references) and identity-relevant topic classification. Two-way logistic regression with interaction term, controlling for length and position.', 1730246400, 1730419200, 'https://osf.io/', 'system', 1730246400, 1730419200),
('exp-8', 'h-8', 'observational', 'completed', 'ds-1', 'r/ChangeMyView Persuasion Corpus', 'Narrative structure annotation via LLM (personal story vs. abstract argument). Logistic regression controlling for length, position, citations, and acknowledgment.', 1732406400, 1732492800, 'https://osf.io/', 'system', 1732406400, 1732492800);

-- Experiment Results
INSERT INTO experiment_results (experiment_id, p_value, effect_size, confidence_interval_low, confidence_interval_high, sample_size, summary, uplift, created_at) VALUES
('exp-1', 0.0003, 0.41, 0.28, 0.54, 4000, 'Counterarguments containing explicit acknowledgment of the OP''s position show a significant positive association with opinion change (OR = 1.51, p < 0.001), robust after controlling for length, citations, and response timing.', NULL, 1726963200),
('exp-3', 0.001, 0.38, 0.22, 0.54, 4000, 'First-three responders achieve 19.9% opinion change rate versus 9.5% for later responders (OR = 2.1, p = 0.001). Effect is robust after controlling for argument quality proxies.', NULL, 1728172800),
('exp-5', 0.002, 0.33, 0.18, 0.48, 2500, 'Counterarguments that frame the issue as a spectrum rather than a binary choice are associated with 1.4x higher opinion change rate (p = 0.002).', NULL, 1729641600),
('exp-6', 0.0008, 0.36, 0.2, 0.52, 3800, 'The interaction between accuracy cues and identity-relevance produces a significant amplification (interaction OR = 1.65, p < 0.001), counter to identity-protective cognition predictions.', NULL, 1730419200),
('exp-8', 0.018, 0.19, 0.04, 0.34, 3200, 'Personal narratives show a positive association with opinion change (OR = 1.22, p = 0.018), but effect attenuates after controlling for argument length.', NULL, 1732492800);

-- Comments
INSERT INTO comments (id, hypothesis_id, user_id, body, doi, parent_id, created_at, updated_at) VALUES
('c-1', 'h-1', 'system', 'This aligns with Petty & Cacioppo''s Elaboration Likelihood Model -- acknowledgment may function as a peripheral cue that increases processing motivation.', '10.1016/S0065-2601(08)60214-2', NULL, 1726617600, 1726617600),
('c-2', 'h-1', 'system', 'I wonder if this effect is moderated by topic sensitivity. On highly polarized topics, acknowledgment might be seen as weakness rather than good faith.', NULL, NULL, 1726790400, 1726790400),
('c-3', 'h-1', 'system', 'The effect size of 0.41 is substantial for this kind of naturalistic data. Would be interesting to see if it replicates in controlled settings.', NULL, 'c-2', 1727222400, 1727222400),
('c-4', 'h-3', 'system', 'This is consistent with the prediction error framework in neuroscience. Incongruent contexts should generate larger hippocampal responses.', '10.1038/nn.4135', NULL, 1731369600, 1731369600),
('c-5', 'h-4', 'system', 'Fascinating -- this connects to the literature on ''attitude latitude'' from Social Judgment Theory. Expanding the latitude of acceptance should indeed facilitate persuasion.', NULL, NULL, 1729814400, 1729814400),
('c-6', 'h-12', 'system', 'This is genuinely surprising. I would not have predicted this interaction from the identity-protective cognition literature. The experimental design here is rigorous.', NULL, NULL, 1730505600, 1730505600),
('c-7', 'h-2', 'system', 'Could this simply be a selection effect? Better arguers might also be faster responders. The position effect may be confounded with argument quality.', NULL, NULL, 1728345600, 1728345600),
('c-8', 'h-2', 'system', 'Good point, but the paper controls for argument quality proxies (length, citations, acknowledgment). The timing effect persists after those controls.', NULL, 'c-7', 1728518400, 1728518400);

-- Arena Matchups
INSERT INTO arena_matchups (id, hypothesis_a_id, hypothesis_b_id, total_votes, votes_a, votes_b, votes_tie, created_at, updated_at) VALUES
('am-1', 'h-1', 'h-4', 342, 189, 127, 26, 1726358400, 1726358400),
('am-2', 'h-3', 'h-7', 215, 134, 62, 19, 1726358400, 1726358400),
('am-3', 'h-5', 'h-8', 178, 95, 68, 15, 1726358400, 1726358400),
('am-4', 'h-2', 'h-6', 256, 167, 72, 17, 1726358400, 1726358400),
('am-5', 'h-12', 'h-11', 198, 121, 58, 19, 1726358400, 1726358400),
('am-6', 'h-9', 'h-10', 143, 78, 51, 14, 1726358400, 1726358400);

-- Backfill denormalized arena win rates from matchup data.
-- Matches the runtime formula in updateWinRatesForMatchup (arena-stats.ts):
-- wins = own votes, win_rate = round((wins + 0.5*ties) / total_votes * 100).
-- Read paths use these columns directly (no on-the-fly matchup scan).
UPDATE hypotheses SET
  arena_wins = (
    SELECT COALESCE(SUM(CASE WHEN m.hypothesis_a_id = hypotheses.id THEN m.votes_a ELSE m.votes_b END), 0)
    FROM arena_matchups m
    WHERE m.hypothesis_a_id = hypotheses.id OR m.hypothesis_b_id = hypotheses.id
  ),
  arena_total = (
    SELECT COALESCE(SUM(m.votes_a + m.votes_b + m.votes_tie), 0)
    FROM arena_matchups m
    WHERE m.hypothesis_a_id = hypotheses.id OR m.hypothesis_b_id = hypotheses.id
  ),
  win_rate = (
    SELECT ROUND(
      (SUM(CASE WHEN m.hypothesis_a_id = hypotheses.id THEN m.votes_a ELSE m.votes_b END) + 0.5 * SUM(m.votes_tie))
      * 100.0 / SUM(m.votes_a + m.votes_b + m.votes_tie)
    )
    FROM arena_matchups m
    WHERE m.hypothesis_a_id = hypotheses.id OR m.hypothesis_b_id = hypotheses.id
  )
WHERE id IN (
  SELECT hypothesis_a_id FROM arena_matchups
  UNION
  SELECT hypothesis_b_id FROM arena_matchups
);
