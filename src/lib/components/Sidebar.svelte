<script lang="ts">
	import { page } from '$app/stores';

	const navItems = [
		{ href: '/controls', icon: 'tune', label: 'Controls' },
		{ href: '/quotes', icon: 'table_chart', label: 'Quote Matrix' },
		{ href: '/depth', icon: 'candlestick_chart', label: 'Order Book Depth' },
		{ href: '/risk', icon: 'bar_chart', label: 'Risk Commander' },
		{ href: '/executions', icon: 'receipt_long', label: 'Executions' },
		{ href: '/pnl', icon: 'analytics', label: 'P&L' }
	];
</script>

<aside class="w-64 h-full flex flex-col bg-[#111722] border-r border-border-dark flex-shrink-0 z-20">
	<div class="flex flex-col p-4 h-full justify-between">
		<div class="flex flex-col gap-6">
			<!-- Branding -->
			<div class="flex flex-col px-2">
				<h1 class="text-white text-xl font-bold tracking-tight">QuotePro</h1>
				<p class="text-text-muted text-xs font-medium">Market Maker Console</p>
			</div>
			<!-- Nav Items -->
			<nav class="flex flex-col gap-2">
				{#each navItems as item}
					<a
						href={item.href}
						class="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors {$page.url
							.pathname === item.href
							? 'bg-[#232f48] text-white'
							: 'text-text-muted hover:text-white hover:bg-surface-dark'}"
					>
						<span
							class="material-symbols-outlined {$page.url.pathname === item.href
								? 'text-primary'
								: ''}">{item.icon}</span
						>
						<p class="text-sm font-medium leading-normal">{item.label}</p>
					</a>
				{/each}
			</nav>
		</div>
		<!-- System Status -->
		<div class="flex items-center gap-3 px-3 py-3 border-t border-border-dark mt-auto">
			<div
				class="w-8 h-8 rounded-full bg-gradient-to-tr from-primary to-purple-500 flex items-center justify-center text-xs font-bold"
			>
				MM
			</div>
			<div class="flex flex-col">
				<p class="text-white text-sm font-medium">Algo Desk</p>
				<p class="text-success text-xs flex items-center gap-1">
					<span class="w-1.5 h-1.5 rounded-full bg-success"></span> Online
				</p>
			</div>
		</div>
	</div>
</aside>
