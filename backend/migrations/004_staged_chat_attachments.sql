-- Migration 004: Allow 'staged' in chat_attachments pipeline_status check constraint
DO $$
BEGIN
    ALTER TABLE chat_attachments DROP CONSTRAINT IF EXISTS chat_attachments_pipeline_status_check;
    ALTER TABLE chat_attachments ADD CONSTRAINT chat_attachments_pipeline_status_check
        CHECK (pipeline_status IN ('staged', 'queued', 'processing', 'completed', 'failed'));
EXCEPTION
    WHEN undefined_table THEN
        NULL;
END $$;
