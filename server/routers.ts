import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { findGroupTimetable, getOfficialTimetable } from "./timetable";
import { getTemporarySectionStudent, prepareTemporarySectionBranch, searchTemporarySectionStudents } from "./temporarySections";
import { getOfficialSyllabusDocument } from "./syllabus";

async function loadGroup(group: string, forceRefresh = false) {
  try {
    const result = await getOfficialTimetable(forceRefresh);
    const timetable = findGroupTimetable(result.cache.data, group);
    if (!timetable) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "That timetable group is not available in the latest official source.",
      });
    }
    return {
      timetable,
      fetchedAt: result.cache.fetchedAt,
      sourceUrl: result.cache.sourceUrl,
      sourceGeneratedAt: result.cache.data.sourceGeneratedAt,
      freshness: result.freshness,
      updateError: result.updateError,
    };
  } catch (error) {
    if (error instanceof TRPCError) throw error;
    throw new TRPCError({
      code: "BAD_GATEWAY",
      message: "We couldn't load the official timetable right now. Please try again shortly.",
      cause: error,
    });
  }
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  timetable: router({
    groups: publicProcedure.query(async () => {
      try {
        const result = await getOfficialTimetable(false);
        return {
          groups: result.cache.data.groups,
          fetchedAt: result.cache.fetchedAt,
          freshness: result.freshness,
          updateError: result.updateError,
        };
      } catch (error) {
        throw new TRPCError({
          code: "BAD_GATEWAY",
          message: "We couldn't reach the official timetable. Please check your connection and try again.",
          cause: error,
        });
      }
    }),
    dashboard: publicProcedure
      .input(z.object({ group: z.string().trim().min(2).max(80) }))
      .query(({ input }) => loadGroup(input.group)),
    refresh: publicProcedure
      .input(z.object({ group: z.string().trim().min(2).max(80) }))
      .mutation(({ input }) => loadGroup(input.group, true)),
  }),
  temporarySections: router({
    prepare: publicProcedure
      .input(z.object({ branch: z.string().trim().toUpperCase().min(2).max(5) }))
      .query(async ({ input }) => {
        try {
          return await prepareTemporarySectionBranch(input.branch);
        } catch (error) {
          const reason = error instanceof Error ? error.message : "The official document could not be read.";
          throw new TRPCError({
            code: "BAD_GATEWAY",
            message: `We couldn't prepare the official temporary-section list. ${reason}`,
            cause: error,
          });
        }
      }),
    search: publicProcedure
      .input(z.object({ branch: z.string().trim().toUpperCase().min(2).max(5), query: z.string().trim().min(2).max(80) }))
      .query(async ({ input }) => {
        try {
          return await searchTemporarySectionStudents(input.branch, input.query);
        } catch (error) {
          throw new TRPCError({
            code: "BAD_GATEWAY",
            message: "We couldn't load the official temporary-section details. You can enter your profile manually instead.",
            cause: error,
          });
        }
      }),
    profile: publicProcedure
      .input(z.object({ branch: z.string().trim().toUpperCase().min(2).max(5), crn: z.string().trim().regex(/^\d{6,16}$/) }))
      .query(async ({ input }) => {
        try {
          return await getTemporarySectionStudent(input.branch, input.crn);
        } catch (error) {
          throw new TRPCError({
            code: "BAD_GATEWAY",
            message: "We couldn't finish the official profile lookup. You can enter your profile manually instead.",
            cause: error,
          });
        }
      }),
  }),
  syllabus: router({
    document: publicProcedure.query(async () => {
      try {
        return await getOfficialSyllabusDocument();
      } catch (error) {
        throw new TRPCError({ code: "BAD_GATEWAY", message: "We couldn't load the official syllabus PDF. Please try again shortly.", cause: error });
      }
    }),
  }),
});

export type AppRouter = typeof appRouter;
