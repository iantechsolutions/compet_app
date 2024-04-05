import { cn } from '~/lib/utils'

export function Title(props: {
    children: React.ReactNode
    className?: string
}) {
    return <h2 className={cn('text-2xl font-semibold mb-3', props.className)}>{props.children}</h2>
}
