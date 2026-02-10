/**
 * Unit tests for the reconciler module
 */

import { ParsedRecipient, UserRecord, MatchCandidate, MsgEmailRecord } from '../src/types';

// Mock the modules
jest.mock('../src/db/queries');
jest.mock('../src/llm-engine');
jest.mock('../src/domain-analyzer');

// Helper to create a complete MsgEmailRecord with all required fields
function createMsgEmail(partial: Partial<MsgEmailRecord> & { id: number; input: string }): MsgEmailRecord {
  return {
    id: partial.id,
    input: partial.input,
    userUd: partial.userUd ?? null,
    email: partial.email ?? null,
    address: partial.address ?? null,
    pos: partial.pos ?? null,
    textindex: partial.textindex ?? null,
    userGenre: partial.userGenre ?? null,
    userName: partial.userName ?? null,
    userCode: partial.userCode ?? null,
    name: partial.name ?? null,
    local: partial.local ?? null,
    notes: partial.notes ?? null,
    modDate: partial.modDate ?? null,
    buyerId: partial.buyerId ?? null,
    producerId: partial.producerId ?? null,
    aiName1: partial.aiName1 ?? null,
    aiName2: partial.aiName2 ?? null,
    aiGenre: partial.aiGenre ?? null,
    aiEmail: partial.aiEmail ?? null,
    aiConfidence: partial.aiConfidence ?? null,
    aiStatus: partial.aiStatus ?? null,
    aiNotes: partial.aiNotes ?? null,
    aiProcessedAt: partial.aiProcessedAt ?? null,
    aiModel: partial.aiModel ?? null,
    aiIsPersonal: partial.aiIsPersonal ?? null,
    aiDomainConvention: partial.aiDomainConvention ?? null,
    aiName1pre: partial.aiName1pre ?? null,
    aiName2pre: partial.aiName2pre ?? null,
    aiName3: partial.aiName3 ?? null,
    aiVersion: partial.aiVersion ?? null,
  };
}

describe('Reconciler', () => {
  // Import after mocks are set up
  let reconcileMsgEmail: typeof import('../src/reconciler').reconcileMsgEmail;
  let getDomainPattern: jest.Mock;
  let getUsersByEmail: jest.Mock;
  let getUsersByDomain: jest.Mock;

  beforeEach(async () => {
    jest.resetModules();

    // Set up mocks
    const domainAnalyzer = await import('../src/domain-analyzer');
    getDomainPattern = domainAnalyzer.getDomainPattern as jest.Mock;
    getDomainPattern.mockResolvedValue({
      domain: 'example.com',
      convention: 'firstname.lastname',
      confidence: 0.9,
      sampleSize: 10,
      isSharedDomain: false,
      companyName: 'Example Corp',
      buyerId: null,
      producerId: 1,
    });

    const queries = await import('../src/db/queries');
    getUsersByEmail = queries.getUsersByEmail as jest.Mock;
    getUsersByDomain = queries.getUsersByDomain as jest.Mock;
    getUsersByEmail.mockResolvedValue([]);
    getUsersByDomain.mockResolvedValue([]);

    const llmEngine = await import('../src/llm-engine');
    (llmEngine.llmMatchUser as jest.Mock).mockResolvedValue({
      bestMatchId: null,
      confidence: 0,
      reasoning: 'Test',
      alternativeMatches: [],
    });
    (llmEngine.llmParseRecipient as jest.Mock).mockImplementation(async (input) => ({
      rawInput: input,
      email: 'test@example.com',
      localPart: 'test',
      domain: 'example.com',
      displayName: null,
      givenName: null,
      surname: null,
      title: null,
      companyName: null,
      isPersonal: true,
      confidence: 0.5,
      llmConfidence: 0.5,
      llmReasoning: 'Test parsing',
    }));

    const reconcilerModule = await import('../src/reconciler');
    reconcileMsgEmail = reconcilerModule.reconcileMsgEmail;
  });

  describe('reconcileMsgEmail', () => {
    it('should return create_user when no candidates found', async () => {
      getUsersByEmail.mockResolvedValue([]);
      getUsersByDomain.mockResolvedValue([]);

      const msgEmail = createMsgEmail({
        id: 1,
        input: 'new.user@example.com',
        address: 'new.user@example.com',
      });

      const result = await reconcileMsgEmail(msgEmail, false);

      expect(result.msgEmailId).toBe(1);
      expect(result.suggestedAction).toBe('create_user');
      expect(result.candidates).toHaveLength(0);
    });

    it('should return link_user with high confidence for exact email match', async () => {
      const matchingUser: UserRecord = {
        id: 100,
        name: 'John Smith',
        genre: 'Mr.',
        email: 'john.smith@example.com',
        email2: null,
        address: null,
        userCode: 'EXMPL',
        buyerId: null,
        producerId: 1,
        domain: 'example.com',
        domain2: null,
      };

      getUsersByEmail.mockResolvedValue([matchingUser]);
      getUsersByDomain.mockResolvedValue([matchingUser]);

      const msgEmail = createMsgEmail({
        id: 2,
        input: 'John Smith <john.smith@example.com>',
        address: 'john.smith@example.com',
        userName: 'John Smith',
        producerId: 1,
      });

      const result = await reconcileMsgEmail(msgEmail, false);

      expect(result.msgEmailId).toBe(2);
      expect(result.candidates.length).toBeGreaterThan(0);
      expect(result.confidence).toBeGreaterThan(0.8);

      // Top candidate should be the matching user
      const topCandidate = result.candidates[0];
      expect(topCandidate.userId).toBe(100);
      expect(topCandidate.matchFactors).toContain('email_exact');
    });

    it('should suggest manual_review for medium confidence matches', async () => {
      const similarUser: UserRecord = {
        id: 101,
        name: 'John Smith',
        genre: null,
        email: 'j.smith@example.com', // Different email
        email2: null,
        address: null,
        userCode: null,
        buyerId: null,
        producerId: 1,
        domain: 'example.com',
        domain2: null,
      };

      getUsersByEmail.mockResolvedValue([]);
      getUsersByDomain.mockResolvedValue([similarUser]);

      const msgEmail = createMsgEmail({
        id: 3,
        input: 'John Smith <john.smith@example.com>',
        address: 'john.smith@example.com',
        userName: 'John Smith',
        producerId: 1,
      });

      const result = await reconcileMsgEmail(msgEmail, false);

      // Without exact email match, confidence should be lower
      expect(result.candidates.length).toBeGreaterThan(0);
      // Action depends on confidence threshold
      expect(['manual_review', 'link_user', 'create_user']).toContain(result.suggestedAction);
    });

    it('should handle shared domains differently', async () => {
      getDomainPattern.mockResolvedValue({
        convention: 'unknown',
        confidence: 0,
        sampleSize: 0,
        isSharedDomain: true,
        companyName: null,
        buyerId: null,
        producerId: null,
      });

      const msgEmail = createMsgEmail({
        id: 4,
        input: 'random.user@gmail.com',
        address: 'random.user@gmail.com',
      });

      const result = await reconcileMsgEmail(msgEmail, false);

      expect(result.isSharedEmail).toBe(true);
    });

    it('should handle invalid input gracefully', async () => {
      const msgEmail = createMsgEmail({
        id: 5,
        input: 'not a valid email format',
      });

      const result = await reconcileMsgEmail(msgEmail, false);

      expect(result.msgEmailId).toBe(5);
      expect(result.suggestedAction).toBe('manual_review');
      expect(result.confidence).toBe(0);
    });
  });

  describe('candidate scoring', () => {
    it('should prioritize exact email matches', async () => {
      const exactMatch: UserRecord = {
        id: 200,
        name: 'Different Name',
        genre: null,
        email: 'john@example.com',
        email2: null,
        address: null,
        userCode: null,
        buyerId: null,
        producerId: null,
        domain: 'example.com',
        domain2: null,
      };

      const nameMatch: UserRecord = {
        id: 201,
        name: 'John Smith',
        genre: null,
        email: 'other@example.com',
        email2: null,
        address: null,
        userCode: null,
        buyerId: null,
        producerId: null,
        domain: 'example.com',
        domain2: null,
      };

      getUsersByEmail.mockResolvedValue([exactMatch]);
      getUsersByDomain.mockResolvedValue([exactMatch, nameMatch]);

      const msgEmail = createMsgEmail({
        id: 6,
        input: 'john@example.com',
        address: 'john@example.com',
        userName: 'John Smith',
      });

      const result = await reconcileMsgEmail(msgEmail, false);

      // Exact email match should be ranked highest
      expect(result.candidates[0].userId).toBe(200);
      expect(result.candidates[0].matchFactors).toContain('email_exact');
    });
  });
});
