"use client";

import { useT } from "@/components/providers/I18nProvider";
import { useAuth } from "@/components/providers/AuthProvider";
import { Spinner } from "@/components/ui/Spinner";
import { useComments } from "../hooks/useComments";
import { CommentComposer } from "./CommentComposer";
import { CommentItem } from "./CommentItem";

/**
 * A Facebook-style comment thread. Omit `stepOrder` for the request-level feed;
 * pass a step's order for that step's thread (shown in the step popup). The
 * parent supplies any heading/Card — this renders just the composer + list.
 */
export function CommentThread({
  requestId,
  stepOrder,
}: {
  requestId: string;
  stepOrder?: number;
}) {
  const t = useT();
  const { user } = useAuth();
  const { comments, loading, reload } = useComments(requestId, stepOrder);

  return (
    <div className="space-y-4">
      <CommentComposer
        requestId={requestId}
        stepOrder={stepOrder}
        onPosted={() => void reload()}
      />

      {loading ? (
        <div className="flex justify-center py-4">
          <Spinner />
        </div>
      ) : comments.length === 0 ? (
        <p className="py-2 text-center text-sm text-muted-foreground">
          {t("comments.empty")}
        </p>
      ) : (
        <div className="space-y-4">
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              requestId={requestId}
              currentUserId={user?.id ?? ""}
              onChanged={() => void reload()}
            />
          ))}
        </div>
      )}
    </div>
  );
}
