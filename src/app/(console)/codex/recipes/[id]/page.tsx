import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  allItems, allRecipes, allShips, getItem, getItemCategory, getRecipe, isModule, formatItemId,
  type ItemStack,
} from '@/data/catalog'
import { facilitiesForRecipe } from '@/data/catalogReference'
import { titleCase } from '@/lib/format'
import { BackLink, Section, ShipRefList, StatGrid, itemHref, type StatEntry } from '../../parts'
import styles from '../../codex.module.css'
import local from '../recipes.module.css'
import { SITE_URL } from '@/lib/links'

export async function generateStaticParams() {
  return allRecipes().map((recipe) => ({ id: recipe.id }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const recipe = getRecipe(id)
  if (!recipe) return {}

  const description =
    recipe.description || `${recipe.name} — crafting recipe in the SpaceMolt catalog.`

  return {
    title: recipe.name,
    description,
    alternates: { canonical: `${SITE_URL}/codex/recipes/${id}` },
    openGraph: {
      type: 'article',
      url: `${SITE_URL}/codex/recipes/${id}`,
      title: `${recipe.name} - SpaceMolt Codex`,
      description,
    },
  }
}

/** Every input/output stack, linked to whichever catalog section the item lives in. */
function StackList({ stacks }: { stacks: ItemStack[] }) {
  return (
    <div className={local.stackList}>
      {stacks.map((stack) => {
        const item = getItem(stack.item_id)
        const kind = item
          ? isModule(item)
            ? `${item.type ?? 'module'} module`
            : getItemCategory(item)
          : undefined
        return (
          <Link key={stack.item_id} href={itemHref(stack.item_id)} className={local.stack}>
            <span className={local.stackQty}>{stack.quantity}x</span>
            <span className={local.stackName}>{formatItemId(stack.item_id)}</span>
            {kind && <span className={local.stackKind}>{kind}</span>}
          </Link>
        )
      })}
    </div>
  )
}

export default async function RecipeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const recipe = getRecipe(id)

  if (!recipe) notFound()

  const inputs = recipe.inputs ?? []
  const outputs = recipe.outputs ?? []

  // Facilities live in the server-only reference module — free on a server component,
  // and never shipped to the browser.
  const facilities = facilitiesForRecipe(id)

  // Hulls and cargo that run this recipe passively, without any crafting action.
  const passiveShips = allShips().filter((ship) => ship.passive_recipes?.includes(id))
  const passiveItems = allItems().filter((item) => item.passive_recipe === id)

  const stats: StatEntry[] = []
  if (recipe.category) stats.push({ label: 'Category', value: recipe.category })
  stats.push({
    label: 'Crafting Time',
    value: recipe.crafting_time
      ? `${recipe.crafting_time} tick${recipe.crafting_time === 1 ? '' : 's'}`
      : 'Instant',
  })
  stats.push({ label: 'Facility Only', value: recipe.facility_only ? 'Yes' : 'No' })
  stats.push({ label: 'Recyclable', value: recipe.no_recycle ? 'No' : 'Yes' })
  if (recipe.fuel_output) {
    stats.push({ label: 'Fuel Output', value: String(recipe.fuel_output) })
  }
  stats.push({ label: 'Inputs', value: String(inputs.length) })
  stats.push({ label: 'Outputs', value: String(outputs.length) })

  return (
    <div className={`console-page ${styles.page}`}>
      <header className="console-page-header">
        <BackLink href="/codex/recipes" label="Recipes" />
        <span className="console-page-kicker">Recipe</span>
        <h1 className="console-page-title">{recipe.name}</h1>
        {recipe.description && <p className={styles.description}>{recipe.description}</p>}
        <div className={styles.tagRow}>
          {recipe.category && <span className={styles.badge}>{recipe.category}</span>}
          <span className={styles.badge}>
            {recipe.facility_only ? 'Facility only' : 'Craftable anywhere'}
          </span>
          {recipe.no_recycle && <span className={styles.badge}>No recycle</span>}
          <span className={styles.badge}>{recipe.id}</span>
        </div>
      </header>

      <Section title="Overview">
        <StatGrid stats={stats} />
      </Section>

      <Section title={`Inputs (${inputs.length})`}>
        {inputs.length > 0 ? (
          <StackList stacks={inputs} />
        ) : (
          <p className={styles.emptyNote}>
            This recipe consumes nothing — it produces its output from raw station capacity.
          </p>
        )}
      </Section>

      <Section title={`Outputs (${outputs.length})`}>
        {outputs.length > 0 && <StackList stacks={outputs} />}
        {recipe.fuel_output != null && recipe.fuel_output > 0 && (
          <p className={styles.emptyNote}>
            Produces {recipe.fuel_output} fuel directly into the tank — fuel is not an item and
            never enters the hold.
          </p>
        )}
        {outputs.length === 0 && !recipe.fuel_output && (
          <p className={styles.emptyNote}>This recipe produces no item output.</p>
        )}
      </Section>

      {facilities.length > 0 && (
        <Section title={`Facilities That Run This (${facilities.length})`}>
          <div className={styles.chipLinkRow}>
            {facilities.map((facility) => (
              <Link
                key={facility.id}
                href={`/codex/facilities/${facility.id}`}
                className={styles.refItem}
              >
                {facility.name}
                {facility.level > 1 ? ` (Lv.${facility.level})` : ''}
              </Link>
            ))}
          </div>
        </Section>
      )}

      {facilities.length === 0 && recipe.facility_only && (
        <Section title="Facilities That Run This">
          <p className={styles.emptyNote}>
            No facility runs this recipe on its own — it is crafted at a station with a general
            crafting service rather than by a dedicated production facility. See{' '}
            <Link href="/codex/facilities">facilities</Link>.
          </p>
        </Section>
      )}

      {passiveShips.length > 0 && (
        <Section title={`Hulls That Run This Passively (${passiveShips.length})`}>
          <p className={styles.emptyNote}>
            These hulls run {recipe.name} automatically while flying — no crafting action needed.
          </p>
          <ShipRefList ships={passiveShips} />
        </Section>
      )}

      {passiveItems.length > 0 && (
        <Section title={`Carried Items That Run This (${passiveItems.length})`}>
          <p className={styles.emptyNote}>
            Carrying one of these in the hold runs {recipe.name} passively while you fly.
          </p>
          <div className={styles.chipLinkRow}>
            {passiveItems.map((item) => (
              <Link key={item.id} href={itemHref(item.id)} className={styles.refItem}>
                {item.name}
              </Link>
            ))}
          </div>
        </Section>
      )}

      <p className={styles.provenance}>
        Recipe id <code>{recipe.id}</code> · {titleCase(recipe.category ?? 'uncategorised')}
      </p>
    </div>
  )
}
