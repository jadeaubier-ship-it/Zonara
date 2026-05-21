// Type definitions for Next.js routes

/**
 * Internal types used by the Next.js router and Link component.
 * These types are not meant to be used directly.
 * @internal
 */
declare namespace __next_route_internal_types__ {
  type SearchOrHash = `?${string}` | `#${string}`
  type WithProtocol = `${string}:${string}`

  type Suffix = '' | SearchOrHash

  type SafeSlug<S extends string> = S extends `${string}/${string}`
    ? never
    : S extends `${string}${SearchOrHash}`
    ? never
    : S extends ''
    ? never
    : S

  type CatchAllSlug<S extends string> = S extends `${string}${SearchOrHash}`
    ? never
    : S extends ''
    ? never
    : S

  type OptionalCatchAllSlug<S extends string> =
    S extends `${string}${SearchOrHash}` ? never : S

  type StaticRoutes = 
    | `/`
    | `/login`
    | `/admin/dashboard`
    | `/admin/candidates`
    | `/admin/candidates/new`
    | `/admin/candidates/archived`
    | `/admin/franchisees`
    | `/admin/settings`
    | `/admin/map`
    | `/admin/workflow`
    | `/api/calendar/availability`
    | `/api/calendar/book`
    | `/api/admin/candidates`
    | `/api/admin/candidates/archive`
    | `/api/admin/candidates/unarchive`
    | `/api/admin/dip-template`
    | `/api/admin/settings`
    | `/api/admin/upload-dip`
    | `/api/admin/validate-step`
    | `/api/admin/export/excel`
    | `/api/admin/export/pdf`
    | `/api/admin/reject-step`
    | `/api/candidate/me`
    | `/api/candidate/steps`
    | `/api/candidate/upload`
    | `/api/cron/daily`
    | `/api/google/callback`
    | `/api/google/connect`
    | `/api/docusign/callback`
    | `/api/docusign/send-envelope`
    | `/api/webhooks/stripe`
    | `/api/webhooks/docusign`
    | `/api/map/franchisees`
    | `/brochure-atome3d.pdf`
    | `/candidat/dashboard`
    | `/dossier/apercu`
    | `/franchisee/dashboard`
    | `/franchisee/documents`
    | `/retour-journee/apercu`
    | `/visio-en-attente`
  type DynamicRoutes<T extends string = string> = 
    | `/admin/candidates/${SafeSlug<T>}`
    | `/admin/candidates/${SafeSlug<T>}/dip`
    | `/api/auth/${CatchAllSlug<T>}`
    | `/api/admin/candidates/${SafeSlug<T>}`
    | `/api/admin/candidates/${SafeSlug<T>}/application-form`
    | `/api/admin/candidates/${SafeSlug<T>}/dip`
    | `/api/admin/candidates/${SafeSlug<T>}/discovery-followup-test`
    | `/api/admin/candidates/${SafeSlug<T>}/documents`
    | `/api/admin/candidates/${SafeSlug<T>}/notes`
    | `/api/admin/candidates/${SafeSlug<T>}/photo`
    | `/api/admin/franchisees/${SafeSlug<T>}`
    | `/api/admin/email-templates/${SafeSlug<T>}`
    | `/api/public/application/${SafeSlug<T>}`
    | `/api/public/candidate-space/${SafeSlug<T>}/profile`
    | `/api/public/candidate-space/${SafeSlug<T>}/credentials`
    | `/api/public/discovery-feedback/${SafeSlug<T>}`
    | `/api/public/mapping/${SafeSlug<T>}/elm/${SafeSlug<T>}`
    | `/candidat/etape/${SafeSlug<T>}`
    | `/dossier/${SafeSlug<T>}`
    | `/espace-candidat/${SafeSlug<T>}`
    | `/espace-candidat/${SafeSlug<T>}/documents/questionnaire`
    | `/espace-candidat/${SafeSlug<T>}/documents/retour-journee`
    | `/espace-candidat/${SafeSlug<T>}/parametres`
    | `/espace-candidat/${SafeSlug<T>}/dashboard`
    | `/mapping/${SafeSlug<T>}`
    | `/onboarding/${SafeSlug<T>}`
    | `/retour-journee/${SafeSlug<T>}`

  type RouteImpl<T> = 
    | StaticRoutes
    | SearchOrHash
    | WithProtocol
    | `${StaticRoutes}${SearchOrHash}`
    | (T extends `${DynamicRoutes<infer _>}${Suffix}` ? T : never)
    
}

declare module 'next' {
  export { default } from 'next/types/index.js'
  export * from 'next/types/index.js'

  export type Route<T extends string = string> =
    __next_route_internal_types__.RouteImpl<T>
}

declare module 'next/link' {
  import type { LinkProps as OriginalLinkProps } from 'next/dist/client/link.js'
  import type { AnchorHTMLAttributes, DetailedHTMLProps } from 'react'
  import type { UrlObject } from 'url'

  type LinkRestProps = Omit<
    Omit<
      DetailedHTMLProps<
        AnchorHTMLAttributes<HTMLAnchorElement>,
        HTMLAnchorElement
      >,
      keyof OriginalLinkProps
    > &
      OriginalLinkProps,
    'href'
  >

  export type LinkProps<RouteInferType> = LinkRestProps & {
    /**
     * The path or URL to navigate to. This is the only required prop. It can also be an object.
     * @see https://nextjs.org/docs/api-reference/next/link
     */
    href: __next_route_internal_types__.RouteImpl<RouteInferType> | UrlObject
  }

  export default function Link<RouteType>(props: LinkProps<RouteType>): JSX.Element
}

declare module 'next/navigation' {
  export * from 'next/dist/client/components/navigation.js'

  import type { NavigateOptions, AppRouterInstance as OriginalAppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime.js'
  interface AppRouterInstance extends OriginalAppRouterInstance {
    /**
     * Navigate to the provided href.
     * Pushes a new history entry.
     */
    push<RouteType>(href: __next_route_internal_types__.RouteImpl<RouteType>, options?: NavigateOptions): void
    /**
     * Navigate to the provided href.
     * Replaces the current history entry.
     */
    replace<RouteType>(href: __next_route_internal_types__.RouteImpl<RouteType>, options?: NavigateOptions): void
    /**
     * Prefetch the provided href.
     */
    prefetch<RouteType>(href: __next_route_internal_types__.RouteImpl<RouteType>): void
  }

  export declare function useRouter(): AppRouterInstance;
}
