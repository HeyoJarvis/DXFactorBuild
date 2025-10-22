# 🔧 Migration Fix - Memory Constraint Issue

## The Problem

You got this error:
```
ERROR: 54000: memory required is 61 MB, maintenance_work_mem is 32 MB
```

This happens because Supabase free tier has limited memory for creating vector indexes.

## ✅ The Solution (Choose One)

### Option 1: Minimal Migration (RECOMMENDED) 

**This always works - no memory issues**

1. Go to: https://app.supabase.com/project/ydbujcuddfgiubjjajuq/sql/new
2. Copy **EVERYTHING** from: `002_code_vector_store_minimal.sql`
3. Paste and click **"Run"**

✅ Creates all tables
✅ Creates all functions
✅ Skips the problematic vector index
✅ Everything works (just slightly slower on huge datasets)

You'll see:
```
✅ Code Vector Store created successfully!
ℹ️  Vector index was NOT created to avoid memory issues.
ℹ️  Searches will still work (just slower on large datasets).
```

### Option 2: Clean Slate + Minimal

If Option 1 gives errors, start completely fresh:

1. First run: `CLEANUP_code_vector_store.sql` (removes everything)
2. Then run: `002_code_vector_store_minimal.sql` (creates fresh)

## What About the Vector Index?

**You don't need it right now!**

The vector index speeds up searches on large datasets. Without it:
- ✅ Indexing repositories works perfectly
- ✅ Queries work perfectly
- ✅ Just a bit slower when you have 10,000+ code chunks

### Add It Later (Optional)

After you've indexed a few repositories:
1. Run: `002b_create_vector_index_later.sql`
2. This creates the index with smart sizing based on your data

## Why Did This Happen?

- Supabase free tier: 32 MB maintenance_work_mem
- Vector index creation needs: 61 MB
- Solution: Skip the index initially, add it when you have data

## Next Steps After Migration

1. ✅ Migration complete
2. Test it: `node test-code-indexer.js`
3. Start app: `npm run dev`
4. Use the code indexer!

The code indexer is fully functional without the vector index. You can add it anytime later! 🚀

