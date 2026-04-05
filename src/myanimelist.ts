#!/usr/bin/env node

const USERNAME = "NatoBoram"
const PAGE_SIZE = 300

/** The type of list to fetch from MyAnimeList. */
const List = {
	anime: "anime",
	manga: "manga",
} as const
type List = (typeof List)[keyof typeof List]

/** Converts a list type to its display name. */
function toListName(list: List) {
	switch (list) {
		case List.anime:
			return "Anime List"

		case List.manga:
			return "Manga List"

		default:
			throw new TypeError("Invalid list type", { cause: { list } })
	}
}

/** The status of an entry in a MyAnimeList list. */
const Status = {
	"In-Progress": 1,
	Completed: 2,
	"On-Hold": 3,
	Dropped: 4,
	Planned: 6,
	All: 7,
} as const
type Status = (typeof Status)[keyof typeof Status]

/** Type guard for {@link Status}. */
function isStatus(value: unknown): value is Status {
	return Object.values<unknown>(Status).includes(value)
}

/** The score of an entry in a MyAnimeList list. */
const Score = {
	Masterpiece: 10,
	Great: 9,
	VeryGood: 8,
	Good: 7,
	Fine: 6,
	Average: 5,
	Bad: 4,
	VeryBad: 3,
	Horrible: 2,
	Appalling: 1,
	None: 0,
} as const
type Score = (typeof Score)[keyof typeof Score]

/** Type guard for {@link Score}. */
function isScore(value: unknown): value is Score {
	return Object.values<unknown>(Score).includes(value)
}

/** Converts the "In-Progress" status into its display name for a given list
 * type. */
function toInProgressName(list: List) {
	switch (list) {
		case List.anime:
			return "Watching"

		case List.manga:
			return "Reading"

		default:
			return "In-Progress"
	}
}

/** Converts the "Planned" status into its display name for a given list
 * type. */
function toPlannedName(list: List) {
	switch (list) {
		case List.anime:
			return "Plan to Watch"

		case List.manga:
			return "Plan to Read"

		default:
			return "Planned"
	}
}

/** Converts a status into its display name for a given list type. */
function toStatusName(status: Status, list: List) {
	switch (status) {
		case Status["In-Progress"]:
			return toInProgressName(list)
		case Status.Completed:
			return "Completed"
		case Status["On-Hold"]:
			return "On-Hold"
		case Status.Dropped:
			return "Dropped"
		case Status.Planned:
			return toPlannedName(list)
		case Status.All:
			return "All"
		default:
			return "Unknown"
	}
}

/** An anime entry in a MyAnimeList list. */
interface Anime {
	readonly anime_title: string
	readonly score: Score
	readonly status: Status
}

/** Type guard for {@link Anime}. */
function isAnimeEntry(entry: Entry): entry is Anime {
	return "anime_title" in entry && typeof entry.anime_title === "string"
}

/** A manga entry in a MyAnimeList list. */
interface Manga {
	readonly manga_title: string
	readonly score: Score
	readonly status: Status
}

/** Type guard for {@link Manga}. */
function isMangaEntry(entry: Entry): entry is Manga {
	return "manga_title" in entry && typeof entry.manga_title === "string"
}

/** An entry in a MyAnimeList list. */
type Entry = Anime | Manga

/** Type guard for {@link Entry}. */
function isEntry(value: unknown): value is Entry {
	if (typeof value !== "object" || value === null) return false

	if (
		!("score" in value) ||
		!isScore(value.score) ||
		!("status" in value) ||
		!isStatus(value.status)
	)
		return false

	if ("anime_title" in value && typeof value.anime_title === "string")
		return true
	if ("manga_title" in value && typeof value.manga_title === "string")
		return true

	return false
}

/** Extracts the title from an entry. */
function entryTitle(entry: Entry) {
	if (isAnimeEntry(entry)) return entry.anime_title
	if (isMangaEntry(entry)) return entry.manga_title
	throw new TypeError("Invalid entry: missing title", { cause: { entry } })
}

/** A display object for {@link Entry}. */
interface DisplayEntry {
	readonly score: Score
	readonly status: Status
	readonly statusName: string
	readonly title: string
}

/** Converts an {@link Entry} into a {@link DisplayEntry}. */
function toDisplayEntry(entry: unknown, list: List) {
	if (!isEntry(entry)) return

	const title = entryTitle(entry)
	const statusName = toStatusName(entry.status, list)

	return {
		title,
		score: entry.score,
		status: entry.status,
		statusName,
	}
}

/** Fetches a single page of data from the MyAnimeList public API. */
async function load(offset: number, list: List) {
	const url = new URL(
		`${list}list/${USERNAME}/load.json`,
		"https://myanimelist.net/",
	)
	url.searchParams.set("offset", offset.toString())
	url.searchParams.set("status", Status.All.toString())

	const response = await fetch(url).catch((error: unknown) => {
		console.error(`An error occurred while fetching the ${list} list.`, {
			error,
		})
	})

	if (!response?.ok) {
		console.error(
			`Failed to fetch ${list} list: ${response?.status} ${response?.statusText}`,
			{ response },
		)
		return []
	}

	const entries: unknown = await response.json()
	if (!Array.isArray(entries)) {
		console.error(`Unexpected response format for ${list} list.`, {
			entries,
		})
		return []
	}

	return entries
		.map(entry => toDisplayEntry(entry, list))
		.filter((entry): entry is DisplayEntry => Boolean(entry))
}

/** Fetches an entire list from the MyAnimeList public API. */
async function loadAll(type: List, entries: DisplayEntry[] = []) {
	let page: DisplayEntry[] = new Array<DisplayEntry>(PAGE_SIZE)
	for (let offset = 0; page.length === PAGE_SIZE; offset += PAGE_SIZE) {
		page = await load(offset, type)
		entries.push(...page)
	}
	return entries
}

/** Displays a list of entries. */
function display(entries: DisplayEntry[], list: List) {
	const scored = entries.filter(entry => entry.score > 0)
	if (scored.length === 0) return

	console.log(`\n## ${toListName(list)}`)

	for (const status of Object.values(Status)) {
		const group = scored.filter(entry => entry.status === status)
		if (group.length === 0) continue

		const statusName = toStatusName(status, list)
		console.log(`\n### ${statusName}`)

		for (const entry of group) {
			console.log(`* ${entry.title}: ${entry.score}/10`)
		}
	}
}

async function main() {
	console.log("Fetching anime list...")
	const animes = await loadAll(List.anime)
	console.log(`Fetched ${animes.length} animes.`)

	console.log("Fetching manga list...")
	const mangas = await loadAll(List.manga)
	console.log(`Fetched ${mangas.length} mangas.`)

	console.log("\n")
	display(animes, List.anime)

	console.log("\n")
	display(mangas, List.manga)
}

await main()
